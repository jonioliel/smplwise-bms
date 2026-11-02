import { test, expect, type Page } from '@playwright/test';

// A11Y-POLISHED-2342: the browser half of the accessibility pass (docs/changes/A11Y-POLISHED-2342.md); the static half is
// tests/unit-a11y-polished-lint.spec.ts. Throwaway elements are mounted on the style guide (demo data, no backend), as in
// tests/a11y-dialog-focus-2310.spec.ts:
//   - a confirmation opened over a dialog: Escape closes the top one only, a second Escape the one below;
//   - sw-popover: Escape inside the card closes it and gives the focus back to where it came from;
//   - sw-field: the slotted control is named by the field's label (the label sits in the shadow root and was never associated).
//   npm run build, then SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/a11y-polished-2342.spec.ts --workers=1

async function styleguide(page: Page) {
  await page.goto('about:blank');
  await page.goto('/?design=a#/styleguide');
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(800);
}

const deepActiveId = (page: Page) =>
  page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return (a as HTMLElement | null)?.id || a?.tagName || '';
  });

test('stacked dialogs: Escape closes only the top one', async ({ page }) => {
  await styleguide(page);
  await page.evaluate(() => {
    type Dlg = HTMLElement & { open: boolean; heading: string };
    const outer = document.createElement('sw-dialog') as Dlg;
    outer.id = 'a11y-outer';
    outer.heading = 'חיצוני';
    outer.innerHTML = '<button id="o-btn">פעולה</button>';
    document.body.append(outer);
    outer.open = true;
    const inner = document.createElement('sw-dialog') as Dlg;
    inner.id = 'a11y-inner';
    inner.heading = 'אישור';
    inner.innerHTML = '<button id="i-btn">אישור</button>';
    setTimeout(() => {
      document.body.append(inner);
      inner.open = true;
    }, 200);
  });
  await page.waitForTimeout(600);
  const open = () => page.evaluate(() => ['a11y-outer', 'a11y-inner'].map((id) => (document.getElementById(id) as unknown as { open: boolean }).open));
  expect(await open()).toEqual([true, true]);
  await page.keyboard.press('Escape');
  await expect.poll(open).toEqual([true, false]);
  await page.keyboard.press('Escape');
  await expect.poll(open).toEqual([false, false]);
});

test('sw-popover: Escape inside the card closes it and the focus goes back to the opener', async ({ page }) => {
  await styleguide(page);
  await page.evaluate(() => {
    const opener = document.createElement('button');
    opener.id = 'pop-opener';
    opener.textContent = 'open';
    opener.style.cssText = 'position:fixed;inset-block-start:4px;inset-inline-start:4px;z-index:5';
    const stage = document.createElement('div');
    stage.style.cssText = 'position:fixed;inset-block-start:60px;inset-inline-start:60px;inline-size:600px;block-size:400px';
    const pop = document.createElement('sw-popover') as HTMLElement & { heading: string };
    pop.id = 'a11y-pop';
    pop.heading = 'כרטיס';
    pop.innerHTML = '<button id="pop-in">פעולה</button>';
    pop.addEventListener('close', () => pop.remove());
    stage.append(pop);
    document.body.append(opener, stage);
    opener.focus();
  });
  // the card's slot exists after its first render: only then is the slotted button rendered and focusable
  await page.waitForFunction(() => !!document.getElementById('a11y-pop')?.shadowRoot?.querySelector('slot'));
  await page.evaluate(() => (document.getElementById('pop-in') as HTMLElement).focus());
  expect(await deepActiveId(page)).toBe('pop-in');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => !!document.getElementById('a11y-pop'))).toBe(false);
  await expect.poll(() => deepActiveId(page)).toBe('pop-opener');
});

test('sw-field names its slotted control with its label', async ({ page }) => {
  await styleguide(page);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset-block-start:60px;inset-inline-start:60px;z-index:5;background:#fff;padding:8px';
    host.innerHTML =
      '<sw-field label="שם המצלמה"><input id="f-in"></sw-field>' +
      '<sw-field label="סוג"><select id="f-sel"><option>א</option></select></sw-field>' +
      '<sw-field label="תווית"><input id="f-own" aria-label="שם משלו"></sw-field>';
    document.body.append(host);
  });
  await expect(page.getByRole('textbox', { name: 'שם המצלמה' })).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'סוג' })).toHaveCount(1);
  // a name the screen gave its control is kept
  await expect(page.locator('#f-own')).toHaveAttribute('aria-label', 'שם משלו');
});
