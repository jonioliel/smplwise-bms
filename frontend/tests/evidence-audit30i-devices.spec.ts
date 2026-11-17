import { settle } from './helpers/settle';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// AUDIT30-I-DEVICES (design audit round 30, branch I: devices, schedules, automations, notification settings). Demo fixtures.
// One regression test per fix (FIXES.md section 10; the owner gates Q3 / Q9 / Q11 taken at their recommended option a):
//   I2 (#4)  the chosen chip (.rc) is the Blue Wash pair, never a solid --dv-text / --sw-accent block
//   I3 (#11) "תזמון חדש" is the shared sw-dialog and opaque; the automation builder's sheet is opaque, no backdrop blur, the dialog radius
//   I4 (#6, #8) schedules, automations, the floor map and presence take their title from sw-page (one H1, on the --sw-h1 tokens)
//   I5 (#5)  the area screen does not scroll the page at 1366x768 or 1440x900
//   I6 (#18) the notification settings are underline tabs, one section at a time (was one 6,699 px page)
//   run_smart.py preview <branch> tests/evidence-audit30i-devices.spec.ts --project=desktop --workers=1

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');

async function open(page: Page, hash: string, size = { width: 1440, height: 900 }) {
  await page.setViewportSize(size);
  await page.route('**/api/v1/**', (route) => route.abort()); // demo mode whatever runs on the preview's proxy target
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.demo.automations', JSON.stringify({ user: 'installer' }));
      localStorage.setItem('sw.demo.schedules', JSON.stringify({ persona: 'admin' }));
    } catch {
      /* private window */
    }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`/?design=a&fit=off&skin=classic#${hash}`);
  await page.waitForSelector('sw-app');
}

/** The rule body of `selector` in a source file (the first one). */
function ruleOf(file: string, selector: string): string {
  const src = read(file);
  const at = src.indexOf(`${selector} {`) >= 0 ? src.indexOf(`${selector} {`) : src.indexOf(`${selector},`);
  expect(at, `${file}: ${selector}`).toBeGreaterThanOrEqual(0);
  return src.slice(src.indexOf('{', at) + 1, src.indexOf('}', at));
}

test.describe('I2 (#4, Q3 a): the chosen chip is the Blue Wash pair', () => {
  test('the .rc rules of the branch read --sw-accent-soft / --sw-accent-text', () => {
    for (const f of ['screens/automation-drawer.ts', 'screens/system-automations.ts', 'components/notify-css.ts', 'screens/devices-schedules.ts', 'screens/devices-automations.ts']) {
      const body = ruleOf(f, ".rc[aria-pressed='true']");
      expect(body, f).toContain('background: var(--sw-accent-soft)');
      expect(body, f).toContain('color: var(--sw-accent-text)');
      expect(body, f).not.toMatch(/background: var\(--(dv-text|sw-accent)\)/);
    }
    const chip = ruleOf('screens/schedule-create-dialog.ts', ".chip[aria-pressed='true']");
    expect(chip).toContain('background: var(--sw-accent-soft)');
  });

  test('the chosen floor chip of the schedules list is painted with the wash, not the text colour', async ({ page }) => {
    await open(page, '/devices/schedules');
    const chip = page.locator('devices-schedules .rc[data-floor=""]');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const [bg, wash, ink, text] = await chip.evaluate((el) => {
      const probe = document.createElement('i');
      el.parentElement!.append(probe);
      probe.style.background = 'var(--sw-accent-soft)';
      probe.style.color = 'var(--sw-accent-text)';
      const r = [getComputedStyle(el).backgroundColor, getComputedStyle(probe).backgroundColor, getComputedStyle(el).color, getComputedStyle(probe).color];
      probe.remove();
      return r;
    });
    expect(bg).toBe(wash);
    expect(ink).toBe(text);
  });
});

test.describe('I3 (#11, Q9 a): dialogs are the shared, opaque ones', () => {
  test('"תזמון חדש" opens in sw-dialog with an opaque box and no blur', async ({ page }) => {
    await open(page, '/devices/schedules');
    await page.locator('devices-schedules [data-new-schedule]').first().click();
    const dlg = page.locator('devices-schedules schedule-create-dialog sw-dialog[data-create-dialog]');
    await expect(dlg).toHaveAttribute('open', '');
    await expect(dlg.locator('[data-template="ac"]')).toBeVisible();
    const box = await dlg.evaluate((el) => {
      const b = el.shadowRoot!.querySelector('.box')!;
      const cs = getComputedStyle(b);
      return { bg: cs.backgroundColor, blur: cs.backdropFilter };
    });
    expect(box.blur).toBe('none');
    expect(box.bg).not.toMatch(/rgba\([^)]*,\s*0?\.\d+\)/); // opaque: no alpha below 1
    // the shared close: Escape closes it (sw-dialog's own key), and the list gets one close
    await page.keyboard.press('Escape');
    await expect(page.locator('devices-schedules schedule-create-dialog')).toHaveCount(0);
  });

  test('the automation builder sheet is opaque, without a backdrop blur, on the dialog radius', async ({ page }) => {
    await open(page, '/devices/automations');
    await page.locator('devices-automations [data-auto-new]').first().click();
    const sheet = page.locator('devices-automations dialog.sheet');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    const st = await sheet.evaluate((el) => {
      const cs = getComputedStyle(el);
      const probe = document.createElement('i');
      el.append(probe);
      probe.style.borderRadius = 'var(--sw-r-xl)';
      const r = { bg: cs.backgroundColor, blur: cs.backdropFilter, radius: cs.borderTopLeftRadius, want: getComputedStyle(probe).borderTopLeftRadius };
      probe.remove();
      return r;
    });
    expect(st.blur).toBe('none');
    expect(st.bg).not.toMatch(/rgba\([^)]*,\s*0?\.\d+\)|\/\s*0?\.\d+\)/);
    expect(st.radius).toBe(st.want);
  });
});

test.describe('I4 (#6, #8): the page frame is sw-page', () => {
  for (const [hash, tag, title] of [
    ['/devices/schedules', 'devices-schedules', 'תזמונים'],
    ['/devices/automations', 'devices-automations', 'אוטומציות'],
    ['/explore/floors/f0', 'explore-floor-map', ''],
    ['/explore/presence', 'explore-presence', ''],
  ] as const) {
    test(`${hash}: one H1, from sw-page`, async ({ page }) => {
      await open(page, hash);
      const h1 = page.locator(`${tag} sw-page h1`);
      await expect(h1).toHaveCount(1, { timeout: 15_000 });
      if (title) await expect(h1).toHaveText(title);
      // no local H1 next to it (the shadow root of the screen itself)
      expect(await page.locator(tag).evaluate((el) => el.shadowRoot!.querySelectorAll('h1').length)).toBe(0);
    });
  }
});

test.describe('I5 (#5): the area screen does not scroll the page', () => {
  for (const size of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }]) {
    test(`/devices/areas/living at ${size.width}x${size.height}`, async ({ page }) => {
      await open(page, '/devices/areas/living', size);
      await page.locator('devices-area').waitFor();
      await page.waitForTimeout(1500);
      const over = await page.evaluate(() => {
        let worst = document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight;
        const walk = (root: Document | ShadowRoot) => {
          for (const el of root.querySelectorAll('*')) {
            if (el.shadowRoot) walk(el.shadowRoot);
            const cs = getComputedStyle(el);
            if (el.tagName === 'DEVICES-AREA' || el.tagName === 'MAIN' || el.classList.contains('main')) {
              if (/(auto|scroll)/.test(cs.overflowY)) worst = Math.max(worst, el.scrollHeight - el.clientHeight);
            }
          }
        };
        walk(document);
        return worst;
      });
      expect(over).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('I6 (#18, Q11 a): the notification settings are underline tabs', () => {
  test('one section at a time; the page is no longer one 6,699 px column', async ({ page }) => {
    await open(page, '/system/notifications');
    const sys = page.locator('sw-app system-notifications');
    await expect(sys.locator('[data-set-state="ready"]')).toBeVisible({ timeout: 15_000 });
    await expect(sys.locator('[data-set-tabs]')).toHaveAttribute('data-variant', 'underline');
    await expect(sys.locator('[data-set-tabs] [role="tab"]')).toHaveCount(9);
    await expect(sys.locator('[data-set-section]')).toHaveCount(1);
    await expect(sys.locator('sw-page h1')).toHaveText('התראות');
    await sys.locator('[data-set-tabs]').getByRole('tab', { name: 'דואר יוצא', exact: true }).click();
    await expect(sys.locator('[data-set-section]')).toHaveCount(1);
    await expect(sys.locator('[data-set-section="mail"]')).toBeVisible();
    await settle(page);
    const tall = await sys.evaluate((el) => el.scrollHeight);
    expect(tall).toBeLessThan(3000);
  });
});
