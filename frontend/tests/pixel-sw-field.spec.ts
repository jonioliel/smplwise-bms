import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// CR-FIELD-UNIT-2470: the shared form field `sw-field`, pinned on its own - a specimen sheet of the plain field and of its UNIT (an affix
// drawn inside the input's frame): a price in ₪ at the reading end and at the start, kWh, m³, a percentage, "days", a hint under one,
// a disabled and a wrong (aria-invalid) value, and an English (left-to-right) block of the same, light and dark, classic skin, demo
// fixtures. The screens that adopted it are pinned by their own shots. Titles carry "pixel-stable" (the gate's pixel lane). Baselines
// are per OS: the Linux ones are generated on the runner with --update-snapshots, looked at, then committed; on an OS without a
// baseline the check is skipped instead of failing on a missing file.
//   run_smart.py preview <branch> tests/pixel-sw-field.spec.ts --project=desktop --project=mobile -u --workers=1 --machine runner

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function specimen(page: Page, scheme: 'light' | 'dark') {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  // the diagnostics screen loads sw-field
  await page.goto(`/?design=a&fit=off&look=performance:full&skin=classic&scheme=${scheme}#/system/diagnostics`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!customElements.get('sw-field'), undefined, { timeout: 30_000 });
  await page.evaluate(() => {
    const sheet = document.createElement('div');
    sheet.setAttribute('data-field-specimen', '');
    sheet.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;overflow:hidden;padding:20px 16px;box-sizing:border-box;display:grid;gap:14px 18px;align-content:start;' +
      'grid-template-columns:repeat(auto-fill,minmax(170px,1fr));background:var(--sw-surface);color:var(--sw-text);font-family:var(--sw-font, inherit);';
    type F = { label: string; value?: string; unit?: string; at?: string; hint?: string; disabled?: boolean; bad?: boolean; numeric?: boolean; key: string; placeholder?: string };
    const field = (host: HTMLElement, f: F) => {
      const el = document.createElement('sw-field');
      el.setAttribute('label', f.label);
      el.setAttribute('data-f', f.key);
      if (f.unit) el.setAttribute('unit', f.unit);
      if (f.at) el.setAttribute('unit-at', f.at);
      if (f.hint) el.setAttribute('hint', f.hint);
      const input = document.createElement('input');
      if (f.numeric !== false) input.setAttribute('inputmode', 'decimal');
      if (f.value !== undefined) input.value = f.value;
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.disabled) input.disabled = true;
      if (f.bad) input.setAttribute('aria-invalid', 'true');
      el.append(input);
      host.append(el);
    };
    const set: F[] = [
      { key: 'plain', label: 'שם המונה', value: 'לוח ראשי', numeric: false },
      { key: 'ils-end', label: 'מחיר לקוט״ש', value: '0.6402', unit: '₪' },
      { key: 'ils-start', label: 'מחיר קבוע', value: '-12.50', unit: '₪', at: 'start' },
      { key: 'kwh', label: 'צריכה', value: '1284.5', unit: 'קוט״ש', hint: 'כולל מע״מ 0.7555' },
      { key: 'm3', label: 'מים', value: '86.02', unit: 'מ״ק' },
      { key: 'pct', label: 'שיעור', value: '18', unit: '%' },
      { key: 'days', label: 'ימים לתשלום', value: '30', unit: 'ימים' },
      { key: 'empty', label: 'מחיר', unit: '₪', placeholder: '0.0000' },
      { key: 'disabled', label: 'מחיר נעול', value: '0.4800', unit: '₪', disabled: true },
      { key: 'bad', label: 'מחיר שגוי', value: 'abc', unit: '₪', bad: true },
    ];
    for (const f of set) field(sheet, f);
    const en = document.createElement('div');
    en.setAttribute('dir', 'ltr');
    en.setAttribute('lang', 'en');
    en.setAttribute('data-ltr-block', '');
    en.style.cssText = 'display:contents';
    sheet.append(en);
    field(en, { key: 'en-end', label: 'Price per kWh', value: '0.6402', unit: '₪' });
    field(en, { key: 'en-start', label: 'Fixed price', value: '12.50', unit: '₪', at: 'start' });
    field(en, { key: 'en-m3', label: 'Water', value: '86.02', unit: 'm³' });
    document.body.append(sheet);
  });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

/** the drawn boxes of one field: the input, the unit, and the input's padding on each side */
function geometry(page: Page, key: string) {
  return page.evaluate((k) => {
    const f = document.querySelector(`[data-field-specimen] sw-field[data-f="${k}"]`) as HTMLElement;
    const input = f.querySelector('input') as HTMLInputElement;
    const unit = f.shadowRoot?.querySelector('[data-unit]') as HTMLElement | null;
    const ir = input.getBoundingClientRect();
    const ur = unit?.getBoundingClientRect();
    const cs = getComputedStyle(input);
    return {
      input: { left: ir.left, right: ir.right, top: ir.top, bottom: ir.bottom },
      unit: ur ? { left: ur.left, right: ur.right, top: ur.top, bottom: ur.bottom, width: ur.width } : null,
      padLeft: parseFloat(cs.paddingLeft),
      padRight: parseFloat(cs.paddingRight),
      direction: cs.direction,
      digits: cs.fontVariantNumeric,
      align: cs.textAlign,
      description: input.getAttribute('aria-description'),
      hostDir: getComputedStyle(f).direction,
    };
  }, key);
}

test.describe('pixel: sw-field', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-fixture spec');

  for (const scheme of ['light', 'dark'] as const) {
    test(`sw-field specimen ${scheme} is pixel-stable`, async ({ page }, info) => {
      const file = `sw-field-${scheme}.png`; // Playwright adds -<project>-<platform>
      if (noBaseline(info, file)) {
        info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
        test.skip(true, `${file}: no baseline on ${process.platform}`);
      }
      await specimen(page, scheme);
      // nothing pushes the page sideways
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
      await expect(page).toHaveScreenshot(file, { animations: 'disabled', maxDiffPixelRatio: 0.002 });
    });
  }

  test('sw-field unit: inside the frame at the reading end (left in Hebrew, right in English), the figure sits against it and never runs under it', async ({ page }) => {
    await specimen(page, 'light');
    // Hebrew, unit at the end: the unit sits at the input's LEFT edge, inside the frame, vertically centred; the left padding clears it
    const he = await geometry(page, 'ils-end');
    expect(he.hostDir).toBe('rtl');
    expect(he.unit).not.toBeNull();
    expect(he.unit!.left).toBeGreaterThan(he.input.left);
    expect(he.unit!.left - he.input.left).toBeLessThan(16);
    expect(he.unit!.right).toBeLessThan(he.input.left + he.padLeft);
    expect(Math.abs((he.unit!.top + he.unit!.bottom) / 2 - (he.input.top + he.input.bottom) / 2)).toBeLessThanOrEqual(1);
    // a figure keeps left-to-right digits in tabular figures; the unit is the input's description
    expect(he.direction).toBe('ltr');
    expect(he.digits).toContain('tabular-nums');
    expect(he.description).toBe('₪');
    // the figure sits against its unit: the unit's side is the text's side
    expect(he.align).toBe('left');
    // Hebrew, unit at the start: the RIGHT edge
    const heStart = await geometry(page, 'ils-start');
    expect(heStart.input.right - heStart.unit!.right).toBeLessThan(16);
    expect(heStart.unit!.left).toBeGreaterThan(heStart.input.right - heStart.padRight);
    expect(heStart.align).toBe('right');
    // a wider unit gets a wider padding (measured, not guessed)
    const kwh = await geometry(page, 'kwh');
    expect(kwh.padLeft).toBeGreaterThan(he.padLeft);
    expect(kwh.unit!.right).toBeLessThan(kwh.input.left + kwh.padLeft);
    // English (left to right): the end is the RIGHT edge, the start the LEFT one
    const en = await geometry(page, 'en-end');
    expect(en.hostDir).toBe('ltr');
    expect(en.input.right - en.unit!.right).toBeLessThan(16);
    expect(en.unit!.left).toBeGreaterThan(en.input.right - en.padRight);
    expect(en.align).toBe('right');
    const enStart = await geometry(page, 'en-start');
    expect(enStart.unit!.left - enStart.input.left).toBeLessThan(16);
    expect(enStart.unit!.right).toBeLessThan(enStart.input.left + enStart.padLeft);
    expect(enStart.align).toBe('left');
    // the plain field has no unit and no description
    const plain = await geometry(page, 'plain');
    expect(plain.unit).toBeNull();
    expect(plain.description).toBeNull();
  });

  test('sw-field unit: a press on the unit types into the input; a unit removed takes its padding and description with it', async ({ page }) => {
    await specimen(page, 'light');
    const f = page.locator('[data-field-specimen] sw-field[data-f="pct"]');
    const box = await f.locator('[data-unit]').boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(f.locator('input')).toBeFocused();
    const wrong = page.locator('[data-field-specimen] sw-field[data-f="bad"] input');
    const ring = await wrong.evaluate((el) => getComputedStyle(el).borderTopColor);
    const danger = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--sw-danger)';
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    expect(ring).toBe(danger);
    await f.evaluate((el) => el.removeAttribute('unit'));
    await expect(f.locator('[data-unit]')).toHaveCount(0);
    await expect(f.locator('input')).not.toHaveAttribute('aria-description', /./);
    await expect(f).not.toHaveAttribute('has-unit', '');
  });
});
