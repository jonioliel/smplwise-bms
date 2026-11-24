import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// CR-CMP2-SELECTS-2450 (owner N11): the shared segmented control `sw-segmented`, pinned on its own - a specimen sheet of its states
// (the default and compact sizes, a count, a disabled key, a disabled group, the block form, a long row that wraps; since
// CR-CMP2-SEGMENTED-C-2450 icon keys - every label, the chosen key's label, icon-only - a badge and two-line keys with a dimmed one) drawn with the app's
// tokens, light and dark, classic skin, demo fixtures. The screens that adopted it are pinned by their own screen shots.
// CR-SEG-MODULE-LOOK-2470 (owner, 20.11): the specimen draws the default, the module look (28 px pill keys, 13 px regular / semibold
// chosen, the chosen key in the text ink; 44 px keys on the phone project).
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
    type Opt = { value: string; label: string; count?: number; disabled?: boolean; icon?: unknown; badge?: string };
    const sheet = document.createElement('div');
    sheet.setAttribute('data-seg-specimen', '');
    sheet.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;overflow:hidden;padding:24px 16px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px;' +
      'align-items:flex-start;background:var(--sw-surface);color:var(--sw-text);font-family:var(--sw-font, inherit);';
    const row = (opts: Opt[], value: string, attrs: Record<string, string> = {}) => {
      const el = document.createElement('sw-segmented') as unknown as HTMLElement & { options: Opt[]; value: string };
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
    const b = document.createElement('sw-segmented') as unknown as HTMLElement & { options: Opt[]; value: string };
    b.options = [{ value: 'own', label: 'ההעדפה שלי' }, { value: 'inst', label: 'ברירת המחדל של ההתקנה' }];
    b.value = 'own';
    b.setAttribute('block', '');
    b.setAttribute('label', 'specimen block');
    block.append(b);
    row(['5', '10', '15', '20', '30', '45', '60', '90', '120'].map((m) => ({ value: m, label: `${m} דק׳` })), '30');
    // CR-CMP2-SEGMENTED-C-2450: rich keys - icons (every label / the chosen key's label / icon-only), a badge, two-line keys with a
    // dimmed one. An option's icon is a template in the app; a DOM node renders the same here (Lit takes a node as a child value).
    const icon = (name: string) => {
      const i = document.createElement('sw-icon');
      i.setAttribute('name', name);
      i.setAttribute('size', '16');
      return i;
    };
    const views = () => [
      { value: 'cards', label: 'כרטיסים', icon: icon('grid') },
      { value: 'table', label: 'טבלה', icon: icon('list') },
      { value: 'cal', label: 'יומן', icon: icon('calendar') },
    ];
    row(views(), 'table');
    row(views(), 'table', { size: 'sm', labels: 'chosen' });
    row(views(), 'cards', { labels: 'none' });
    row([{ value: 's', label: 'קטן' }, { value: 'm', label: 'בינוני', badge: 'נוכחי' }, { value: 'l', label: 'גדול' }], 'l');
    const two = document.createElement('div');
    two.style.cssText = 'inline-size:min(100%, 420px);display:flex';
    sheet.append(two);
    const t = document.createElement('sw-segmented') as unknown as HTMLElement & { options: unknown[]; value: string };
    t.options = [
      { value: 'user', label: 'בעלי חשבון', sub: 'מטפלים במערכת' },
      { value: 'emp', label: 'עובדים', sub: 'אין עובדים במחלקה', dimmed: true },
      { value: 'out', label: 'מחוץ למערכת', sub: 'ספקים ואנשי קשר' },
    ];
    t.value = 'user';
    t.setAttribute('block', '');
    t.setAttribute('label', 'specimen two-line');
    two.append(t);
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

  test('sw-segmented rich keys: an icon-only key is named by its label; a roving group chooses with the arrows and has one Tab stop', async ({ page }) => {
    await specimen(page, 'light');
    const groups = page.locator('[data-seg-specimen] sw-segmented');
    // labels="chosen" (the 9th group): the chosen key shows its label, the others only their icon and take the label as their name
    const chosen = groups.nth(8);
    await expect(chosen.locator('button[aria-pressed="true"] [part="label"]')).toHaveText('טבלה');
    await expect(chosen.locator('button[aria-label="כרטיסים"]')).toHaveAttribute('title', 'כרטיסים');
    await expect(chosen.locator('button[aria-label="כרטיסים"] [part="label"]')).toHaveCount(0);
    // labels="none": every key is icon-only and named
    await expect(groups.nth(9).locator('button[aria-label]')).toHaveCount(3);
    // the badge and the two-line keys
    await expect(groups.nth(10).locator('[part="badge"]')).toHaveText('נוכחי');
    await expect(groups.nth(11).locator('button.dim [part="sub"]')).toHaveText('אין עובדים במחלקה');
    // roving: the arrows choose the next key (a change), the host confirms, one key is in the Tab order
    const r = groups.nth(7);
    await r.evaluate((el) => {
      el.setAttribute('roving', '');
      (el as unknown as { roving: boolean }).roving = true;
      (window as unknown as { rov: string[] }).rov = [];
      el.addEventListener('change', (e) => {
        const v = (e as CustomEvent<{ value: string }>).detail.value;
        (window as unknown as { rov: string[] }).rov.push(v);
        (el as HTMLElement & { value: string }).value = v;
      });
    });
    await expect(r.locator('button[tabindex="0"]')).toHaveCount(1);
    await expect(r.locator('button[tabindex="0"]')).toHaveAttribute('aria-pressed', 'true');
    await r.locator('button[tabindex="0"]').focus();
    const rtl = await r.evaluate((el) => getComputedStyle(el).direction === 'rtl');
    await page.keyboard.press(rtl ? 'ArrowLeft' : 'ArrowRight');
    expect(await page.evaluate(() => (window as unknown as { rov: string[] }).rov)).toEqual(['cal']);
    await expect(r.locator('button[aria-pressed="true"]')).toHaveAttribute('tabindex', '0');
    await expect(r.locator('button[aria-pressed="true"]')).toBeFocused();
  });
});
