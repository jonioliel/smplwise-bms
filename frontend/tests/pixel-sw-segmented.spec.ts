import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// CR-CMP2-SELECTS-2450 (owner N11): the shared segmented control `sw-segmented`, pinned on its own - a specimen sheet of its states
// (the default and compact sizes, a count, a disabled key, a disabled group, the block form, a long row that wraps) drawn with the app's
// tokens, light and dark, classic skin, demo fixtures. The screens that adopted it are pinned by their own screen shots.
// Titles carry "pixel-stable" (the gate's pixel lane). Baselines are per OS: the Linux ones are generated on the runner with
// --update-snapshots, looked at, then committed; on an OS without a baseline the check is skipped instead of failing on a missing file.
//   run_smart.py preview <branch> tests/pixel-sw-segmented.spec.ts --project=desktop --project=mobile -u --workers=1 --machine runner

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function specimen(page: Page, scheme: 'light' | 'dark') {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  // the look settings page loads sw-segmented (system-look / system-design / system-plan-view use it)
  await page.goto(`/?design=a&fit=off&look=performance:full&skin=classic&scheme=${scheme}#/system/diagnostics`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!customElements.get('sw-segmented'), undefined, { timeout: 30_000 });
  await page.evaluate(() => {
    type Opt = { value: string; label: string; count?: number; disabled?: boolean };
    const sheet = document.createElement('div');
    sheet.setAttribute('data-seg-specimen', '');
    sheet.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;overflow:hidden;padding:24px 16px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px;' +
      'align-items:flex-start;background:var(--sw-surface);color:var(--sw-text);font-family:var(--sw-font, inherit);';
    const row = (opts: Opt[], value: string, attrs: Record<string, string> = {}) => {
      const el = document.createElement('sw-segmented') as HTMLElement & { options: Opt[]; value: string };
      el.options = opts;
      el.value = value;
      el.setAttribute('label', 'specimen');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      sheet.append(el);
    };
    const three = [
      { value: 'a', label: 'אוטומטי' },
      { value: 'b', label: 'מלא' },
      { value: 'c', label: 'מופחת' },
    ];
    row(three, 'b');
    row(three, 'a', { size: 'sm' });
    row([{ value: 'all', label: 'הכל' }, { value: 'failed', label: 'רק כשלים', count: 3 }], 'failed');
    row([...three.slice(0, 2), { value: 'c', label: 'מופחת', disabled: true }], 'a');
    row(three, 'c', { disabled: '' });
    const block = document.createElement('div');
    block.style.cssText = 'inline-size:min(100%, 340px);display:flex';
    sheet.append(block);
    const b = document.createElement('sw-segmented') as HTMLElement & { options: Opt[]; value: string };
    b.options = [{ value: 'own', label: 'ההעדפה שלי' }, { value: 'inst', label: 'ברירת המחדל של ההתקנה' }];
    b.value = 'own';
    b.setAttribute('block', '');
    b.setAttribute('label', 'specimen block');
    block.append(b);
    row(['5', '10', '15', '20', '30', '45', '60', '90', '120'].map((m) => ({ value: m, label: `${m} דק׳` })), '30');
    document.body.append(sheet);
  });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

test.describe('pixel: sw-segmented', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-fixture spec');

  for (const scheme of ['light', 'dark'] as const) {
    test(`sw-segmented specimen ${scheme} is pixel-stable`, async ({ page }, info) => {
      const file = `sw-segmented-${scheme}.png`; // Playwright adds -<project>-<platform>
      if (noBaseline(info, file)) {
        info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
        test.skip(true, `${file}: no baseline on ${process.platform}`);
      }
      await specimen(page, scheme);
      const sheet = page.locator('[data-seg-specimen]');
      // the chosen key is the light pill in dark (GATE2370-B) and the card surface in light: both draw a thumb distinct from the track
      const thumb = await sheet.locator('sw-segmented').first().evaluate((el) => {
        const k = el.shadowRoot?.querySelector('button[aria-pressed="true"]');
        const t = el.shadowRoot?.querySelector('.seg');
        return k && t ? [getComputedStyle(k).backgroundColor, getComputedStyle(t).backgroundColor] : null;
      });
      expect(thumb).not.toBeNull();
      expect(thumb?.[0]).not.toBe(thumb?.[1]);
      // no key is clipped or pushes the page sideways (the long row wraps)
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
      await expect(page).toHaveScreenshot(file, { animations: 'disabled', maxDiffPixelRatio: 0.002 });
    });
  }

  test('sw-segmented behaviour: a press fires change with the value; the thumb waits for the host; arrows move the focus', async ({ page }) => {
    await specimen(page, 'light');
    const seg = page.locator('[data-seg-specimen] sw-segmented').first();
    await seg.evaluate((el) => {
      (window as unknown as { segSeen: string[] }).segSeen = [];
      // listen on the sheet (the event bubbles and is composed): the disabled groups below must stay silent too
      el.parentElement?.addEventListener('change', (e) => (window as unknown as { segSeen: string[] }).segSeen.push((e as CustomEvent<{ value: string }>).detail.value));
    });
    await seg.locator('button', { hasText: 'מופחת' }).click();
    expect(await page.evaluate(() => (window as unknown as { segSeen: string[] }).segSeen)).toEqual(['c']);
    // controlled: the chosen key is still the host's value until the host sets a new one
    await expect(seg.locator('button[aria-pressed="true"]')).toHaveText('מלא');
    await seg.evaluate((el) => ((el as HTMLElement & { value: string }).value = 'c'));
    await expect(seg.locator('button[aria-pressed="true"]')).toHaveText('מופחת');
    // the group is named and the keys are toggle buttons
    await expect(seg.locator('[role="group"]')).toHaveAttribute('aria-label', 'specimen');
    // keyboard: focus the first key, the reading-direction arrow walks to the next one (RTL: ArrowLeft)
    await seg.locator('button').first().focus();
    const rtl = await page.evaluate(() => getComputedStyle(document.querySelector('[data-seg-specimen] sw-segmented') as Element).direction === 'rtl');
    await page.keyboard.press(rtl ? 'ArrowLeft' : 'ArrowRight');
    await expect(seg.locator('button').nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(seg.locator('button').nth(2)).toBeFocused();
    // a disabled key and a disabled group fire nothing
    const groups = page.locator('[data-seg-specimen] sw-segmented');
    await groups.nth(3).locator('button', { hasText: 'מופחת' }).click({ force: true });
    await groups.nth(4).locator('button').first().click({ force: true });
    expect(await page.evaluate(() => (window as unknown as { segSeen: string[] }).segSeen)).toEqual(['c']);
  });
});
