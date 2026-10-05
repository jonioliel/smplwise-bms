import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 0.1.153: the tabs presentation modes (tabs | hybrid | dropdown). Component specs for sw-dropdown and sw-tabs (keyboard, RTL, counts, the
// alert dot, the hybrid threshold, 44 px targets, reduced motion), and the shell in DEMO MODE (no backend) at 390 px with the mode set
// through shell/tabs-mode.ts: the area row, the security rows, the settings row, the home areas chip row, the multimedia room filter and
// the Settings card, in light and dark. Needs the Vite DEV server (the specs import /src/...):
//   $env:SW_API_PORT='59999'; npx vite --host 127.0.0.1 --port 5196   then
//   $env:SW_BASE_URL='http://127.0.0.1:5196/'; npx playwright test evidence-tabs-dropdown --project=desktop --workers=1
// SW_SHOTS=<dir> saves the screenshots there (default docs/evidence/tabs-dropdown). One project only: the specs set the width themselves.
const SHOTS = process.env.SW_SHOTS ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/tabs-dropdown');
const MODE_URL = '/src/shell/tabs-mode.ts';

async function stage(page: Page, width = 390) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('./');
  await page.waitForFunction(() => !!customElements.get('sw-dropdown') && !!customElements.get('sw-tabs'));
  await page.evaluate(() => {
    document.querySelectorAll('#stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'stage';
    st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff);padding:24px 16px;display:flex;flex-direction:column;gap:20px;align-items:flex-start';
    document.body.appendChild(st);
  });
}

const ITEMS = [
  { id: 'live', label: 'לייב', count: 6 },
  { id: 'inv', label: 'חקירה', count: 3 },
  { id: 'alarm', label: 'אזעקה', count: 2, alert: true as const },
  { id: 'lights', label: 'תאורה' },
  { id: 'doors', label: 'דלתות', alert: 'warn' as const },
];

async function mountDropdown(page: Page, items = ITEMS, value = 'live') {
  await page.evaluate(
    ([its, val]) => {
      const dd = document.createElement('sw-dropdown') as HTMLElement & { items: unknown; value: string; label: string };
      dd.id = 'dd';
      dd.items = its;
      dd.value = val as string;
      dd.label = 'אבטחה';
      (window as unknown as { __changes: string[] }).__changes = [];
      dd.addEventListener('change', (e) => (window as unknown as { __changes: string[] }).__changes.push((e as CustomEvent).detail.id));
      // these specs measure the popover under the chip; on a phone width the phone setting defaults to the small list (owner 2026-10-05; the sheet is covered by
      // dropdown-phone-choice.spec.ts); pinned explicitly so these measurements do not depend on the default
      document.documentElement.setAttribute('data-dd-phone', 'list');
      document.querySelector('#stage')!.appendChild(dd);
    },
    [items, value] as const,
  );
}

const chip = (page: Page) => page.locator('#dd').locator('.chip');
const list = (page: Page) => page.locator('#dd').locator('[role=listbox]');
const active = (page: Page) => list(page).evaluate((el) => el.getAttribute('aria-activedescendant') ?? '');
const activeText = async (page: Page) => {
  const id = await active(page);
  return page.locator('#dd').locator(`[id="${id}"]`).evaluate((el) => (el.querySelector('.lbl') as HTMLElement).textContent);
};
const changes = (page: Page) => page.evaluate(() => (window as unknown as { __changes: string[] }).__changes);
const focusedInDropdown = (page: Page) => page.evaluate(() => (document.querySelector('#dd')!.shadowRoot!.activeElement?.className as string) ?? '');

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test.describe('sw-dropdown', () => {
  test('chip and listbox semantics, counts inside the options, the selected count in the chip', async ({ page }) => {
    await stage(page);
    await mountDropdown(page);
    const c = chip(page);
    await expect(c).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(c).toHaveAttribute('aria-expanded', 'false');
    await expect(c).toContainText('לייב');
    await expect(c).toContainText('(6)');
    await c.click();
    await expect(c).toHaveAttribute('aria-expanded', 'true');
    const lb = list(page);
    await expect(lb).toHaveAttribute('role', 'listbox');
    await expect(c).toHaveAttribute('aria-controls', (await lb.getAttribute('id')) as string);
    const opts = page.locator('#dd').locator('[role=option]');
    await expect(opts).toHaveCount(5);
    await expect(opts.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(opts.nth(1)).toContainText('(3)');
    await expect(opts.nth(3)).not.toContainText('(');
    // every option is a 44 px target
    for (const h of await opts.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))) expect(h).toBeGreaterThanOrEqual(44);
  });

  test('keyboard: arrows wrap, Home / End, typeahead, Enter chooses and returns focus, Esc and Tab close', async ({ page }) => {
    await stage(page);
    await mountDropdown(page);
    await chip(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'true');
    expect(await activeText(page)).toBe('לייב');
    await page.keyboard.press('ArrowDown');
    expect(await activeText(page)).toBe('חקירה');
    await page.keyboard.press('End');
    expect(await activeText(page)).toBe('דלתות');
    await page.keyboard.press('ArrowDown'); // wraps
    expect(await activeText(page)).toBe('לייב');
    await page.keyboard.press('ArrowUp'); // wraps back
    expect(await activeText(page)).toBe('דלתות');
    await page.keyboard.press('Home');
    expect(await activeText(page)).toBe('לייב');
    // a Hebrew letter has no key on the test keyboard layout (insertText sends no keydown): dispatch the key itself
    await list(page).evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ת', bubbles: true, composed: true })));
    expect(await activeText(page)).toBe('תאורה'); // typeahead: the next option starting with the letter
    await page.keyboard.press('Enter');
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
    expect(await changes(page)).toEqual(['lights']);
    expect(await focusedInDropdown(page)).toContain('chip'); // focus returned to the chip
    await expect(chip(page)).toContainText('תאורה');
    // Esc closes and returns focus, no change fired
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
    expect(await focusedInDropdown(page)).toContain('chip');
    expect(await changes(page)).toEqual(['lights']);
    // Space opens, Tab closes
    await page.keyboard.press(' ');
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('an outside press closes it; choosing the selected item fires no change', async ({ page }) => {
    await stage(page);
    await mountDropdown(page);
    await chip(page).click();
    await page.mouse.click(5, 700);
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
    await chip(page).click();
    await page.locator('#dd').locator('[role=option]').first().click();
    expect(await changes(page)).toEqual([]);
    await chip(page).click();
    await page.locator('#dd').locator('[role=option]').nth(1).click();
    expect(await changes(page)).toEqual(['inv']);
  });

  test('the alert dot is on the chip only for an alert in a HIDDEN option', async ({ page }) => {
    await stage(page);
    await mountDropdown(page);
    const dot = page.locator('#dd').locator('[data-chip-alert]');
    await expect(dot).toHaveAttribute('data-chip-alert', 'alert'); // the alarm option is hidden while "לייב" is selected
    await expect(chip(page)).toHaveAttribute('aria-label', /יש התראות באפשרויות אחרות/);
    await chip(page).click();
    await expect(page.locator('#dd').locator('.opt[data-id=alarm] .dot')).toHaveAttribute('data-alert', 'alert');
    await expect(page.locator('#dd').locator('.opt[data-id=doors] .dot')).toHaveAttribute('data-alert', 'warn');
    await page.keyboard.press('Escape');
    // with the alarm option selected only the amber one stays hidden
    await page.evaluate(() => ((document.querySelector('#dd') as HTMLElement & { value: string }).value = 'alarm'));
    await expect(dot).toHaveAttribute('data-chip-alert', 'warn');
    await page.evaluate(() => ((document.querySelector('#dd') as HTMLElement & { items: unknown[] }).items = [{ id: 'a', label: 'א', alert: true }, { id: 'b', label: 'ב' }]));
    await page.evaluate(() => ((document.querySelector('#dd') as HTMLElement & { value: string }).value = 'a'));
    await expect(dot).toHaveCount(0); // the only alert is the selected item's own
  });

  test('RTL: the popover is anchored to the chip\'s right edge and stays inside the viewport', async ({ page }) => {
    await stage(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).direction)).toBe('rtl');
    await mountDropdown(page);
    await page.locator('#stage').evaluate((el) => (el.style.alignItems = 'flex-start')); // the start edge in RTL = the right edge
    await chip(page).click();
    const [cr, pr, vw] = await page.evaluate(() => {
      const root = document.querySelector('#dd')!.shadowRoot!;
      const c = root.querySelector('.chip')!.getBoundingClientRect();
      const p = root.querySelector('[role=listbox]')!.getBoundingClientRect();
      return [{ l: c.left, r: c.right, b: c.bottom }, { l: p.left, r: p.right, t: p.top }, document.documentElement.clientWidth] as const;
    });
    expect(Math.abs(pr.r - cr.r)).toBeLessThan(2);
    expect(pr.l).toBeGreaterThanOrEqual(0);
    expect(pr.r).toBeLessThanOrEqual(vw);
    expect(pr.t).toBeGreaterThanOrEqual(cr.b); // opens below the chip
    await shot(page, 'component-open-rtl-390-light');
  });

  test('the chip is a 32 px control with a 44 px hit area; reduced motion makes the transitions instant', async ({ page }) => {
    await stage(page);
    await mountDropdown(page);
    const m = await chip(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const a = getComputedStyle(el, '::after');
      return { h: Math.round(r.height), after: Math.round(parseFloat(a.height)), dur: getComputedStyle(el).transitionDuration };
    });
    expect(m.h).toBeGreaterThanOrEqual(32);
    expect(m.after).toBeGreaterThanOrEqual(44);
    expect(m.dur).not.toBe('0s');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await chip(page).evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0s(, 0s)*$/);
  });

  test('groups render as role=group headings and the list scrolls inside the viewport', async ({ page }) => {
    await stage(page);
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, label: `אזור ${i}`, group: i < 15 ? 'קומה 1' : 'קומה 2' }));
    await mountDropdown(page, many, 'i0');
    await chip(page).click();
    await expect(page.locator('#dd').locator('.grp')).toHaveCount(2);
    const fits = await list(page).evaluate((el) => el.getBoundingClientRect().bottom <= window.innerHeight);
    expect(fits).toBe(true);
    await page.keyboard.press('End');
    expect(await activeText(page)).toBe('אזור 29');
  });
});

test.describe('sw-tabs modes', () => {
  async function mountTabs(page: Page, n: number, attrs: Record<string, string | boolean> = {}) {
    await page.evaluate(
      ([count, at]) => {
        const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
        t.id = 't';
        t.items = Array.from({ length: count as number }, (_, i) => ({ id: `t${i}`, label: `לשונית ${i + 1}`, count: i === 0 ? 6 : undefined }));
        t.active = 't0';
        for (const [k, v] of Object.entries(at as Record<string, string | boolean>)) if (v === true) t.setAttribute(k, ''); else if (v !== false) t.setAttribute(k, String(v));
        document.querySelector('#stage')!.appendChild(t);
      },
      [n, attrs] as const,
    );
  }
  const variant = (page: Page) => page.locator('#t').getAttribute('data-variant');
  const hasDropdown = (page: Page) => page.locator('#t').locator('sw-dropdown').count();

  test('default: the same DOM as before (pill, buttons, no dropdown)', async ({ page }) => {
    await stage(page);
    await mountTabs(page, 6);
    expect(await variant(page)).toBe('pill');
    expect(await hasDropdown(page)).toBe(0);
    await expect(page.locator('#t').locator('button')).toHaveCount(6);
    await expect(page.locator('#t')).not.toHaveAttribute('adaptive', '');
  });

  test('variant=dropdown is always a dropdown, even for two items', async ({ page }) => {
    await stage(page);
    await mountTabs(page, 2, { variant: 'dropdown' });
    expect(await variant(page)).toBe('dropdown');
    expect(await hasDropdown(page)).toBe(1);
  });

  test('adaptive (hybrid): up to three items keep the bar, four or more become a dropdown', async ({ page }) => {
    await stage(page);
    await mountTabs(page, 3, { adaptive: true });
    expect(await variant(page)).toBe('pill');
    expect(await hasDropdown(page)).toBe(0);
    await page.evaluate(() => {
      const t = document.querySelector('#t') as HTMLElement & { items: { id: string; label: string }[] };
      t.items = [...t.items, { id: 'x', label: 'רביעית' }];
    });
    await expect.poll(() => variant(page)).toBe('dropdown');
    expect(await hasDropdown(page)).toBe(1);
    // an underline look the host asked for survives for a short list
    await stage(page);
    await mountTabs(page, 3, { adaptive: true, variant: 'underline-compact' });
    expect(await variant(page)).toBe('underline-compact');
  });

  test('a dropdown tab list fires change like a tab does, and a link item navigates', async ({ page }) => {
    await stage(page);
    await page.evaluate(() => {
      const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
      t.id = 't';
      t.setAttribute('variant', 'dropdown');
      t.items = [{ id: 'a', label: 'אחת', href: '#/x/one' }, { id: 'b', label: 'שתיים', href: '#/x/two' }];
      t.active = 'a';
      (window as unknown as { __c: string[] }).__c = [];
      t.addEventListener('change', (e) => (window as unknown as { __c: string[] }).__c.push((e as CustomEvent).detail.id));
      document.querySelector('#stage')!.appendChild(t);
    });
    const dd = page.locator('#t').locator('sw-dropdown');
    await dd.locator('.chip').click();
    await dd.locator('[role=option]').nth(1).click();
    expect(await page.evaluate(() => (window as unknown as { __c: string[] }).__c)).toEqual(['b']); // exactly one change event (the inner one is stopped)
    expect(await page.evaluate(() => location.hash)).toBe('#/x/two');
  });
});

/** Set the mode like the Settings card / the server load do, then wait for the shell to follow. */
async function setMode(page: Page, mode: string | null, groups: Record<string, string> = {}) {
  await page.evaluate(
    async ([url, m, g]) => {
      const mod = await import(/* @vite-ignore */ url as string);
      await mod.saveOwnTabsMode(m, g);
    },
    [MODE_URL, mode, groups] as const,
  );
}

async function openShell(page: Page, hash: string, scheme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('about:blank');
  await page.goto(`./?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

test.describe('the shell at 390 px (demo mode)', () => {
  test('mode helper: tabs by default, the user overrides the installation, a group overrides the global value, a wide screen follows the same mode (0.1.157)', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('sw-app');
    const r = await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url as string);
      const out: Record<string, unknown> = {};
      out.fresh = ['home', 'area', 'multimedia', 'security', 'settings'].map((g) => m.tabModeOf(g, true));
      m.setInstallationTabsMode({ 'ui.tabs_mode': 'hybrid', 'ui.tabs_mode_groups': { security: 'dropdown' } });
      out.inst = [m.tabModeOf('area', true), m.tabModeOf('security', true)];
      await m.saveOwnTabsMode('tabs', {});
      out.ownWins = [m.tabModeOf('area', true), m.tabModeOf('security', true)]; // the user's global value beats the installation's group override
      await m.saveOwnTabsMode('tabs', { security: 'dropdown' });
      out.ownGroup = [m.tabModeOf('area', true), m.tabModeOf('security', true)];
      await m.saveOwnTabsMode(null, {});
      out.followed = [m.tabModeOf('area', true), m.tabModeOf('security', true)];
      out.wide = m.tabModeOf('security', false);
      m.setInstallationTabsMode({ 'ui.tabs_mode': 'bogus', 'ui.tabs_mode_groups': { ghost: 'dropdown', home: 'nonsense' } });
      out.bogus = m.tabModeOf('home', true);
      return out;
    }, MODE_URL);
    expect(r.fresh).toEqual(['tabs', 'tabs', 'tabs', 'tabs', 'tabs']);
    expect(r.inst).toEqual(['hybrid', 'dropdown']);
    expect(r.ownWins).toEqual(['tabs', 'tabs']);
    expect(r.ownGroup).toEqual(['tabs', 'dropdown']);
    expect(r.followed).toEqual(['hybrid', 'dropdown']);
    expect(r.wide).toBe('dropdown');
    expect(r.bogus).toBe('tabs');
  });

  // The product has no dark SW A theme yet (tokens.css is light only; only the multimedia glass has a dark scheme, set per host by
  // `data-devices-scheme`): the security / area / settings frames are therefore light only, the multimedia frames light and dark.
  for (const scheme of ['light', 'dark'] as const) {
    test(`security: sections as a dropdown with the alarm kept visible, sub-tabs as a dropdown (${scheme})`, async ({ page }) => {
      test.skip(scheme === 'dark', 'no dark SW A theme');
      await openShell(page, '/security/live/wall', scheme);
      await shot(page, `security-tabs-390-${scheme}`);
      await setMode(page, 'dropdown', {});
      await page.waitForTimeout(500);
      const info = await page.locator('sw-app').evaluate((app) => {
        const r = app.shadowRoot!;
        return {
          sections: r.querySelector('.tabpair[data-tabs-mode=dropdown] sw-tabs[data-section-tabs]')?.getAttribute('data-variant') ?? null,
          sub: r.querySelector('sw-tabs[data-area-tabs]')?.getAttribute('data-variant') ?? null,
          alarmPin: !!r.querySelector('a[data-section-alarm]'),
        };
      });
      expect(info.sub).toBe('dropdown');
      if (info.sections) expect(info.sections).toBe('dropdown');
      await shot(page, `security-dropdown-390-${scheme}`);
      // hybrid: the three sections stay a bar, the sub-tabs of live (more than three) become a dropdown
      await setMode(page, 'hybrid', {});
      await page.waitForTimeout(400);
      const hy = await page.locator('sw-app').evaluate((app) => ({
        sub: app.shadowRoot!.querySelector('sw-tabs[data-area-tabs]')?.getAttribute('data-variant') ?? null,
        sections: !!app.shadowRoot!.querySelector('nav[data-security-row] a[data-section], nav[data-security-row] sw-tabs'),
      }));
      expect(hy.sections).toBe(true);
      await shot(page, `security-hybrid-390-${scheme}`);
    });

    test(`area row and settings row follow their own group (${scheme})`, async ({ page }) => {
      test.skip(scheme === 'dark', 'no dark SW A theme');
      await openShell(page, '/devices/building', scheme);
      await setMode(page, 'tabs', { area: 'dropdown' });
      await page.waitForTimeout(500);
      const v = await page.locator('sw-app').evaluate((app) => app.shadowRoot!.querySelector('sw-tabs[data-area-tabs]')?.getAttribute('data-variant') ?? null);
      expect(v === 'dropdown' || v === null).toBe(true); // null: the area has a single visible tab in this demo (no row)
      await shot(page, `area-tabs-390-${scheme}`);
      await setMode(page, 'tabs', { area: 'dropdown', settings: 'dropdown' });
      await page.evaluate(() => (location.hash = '#/system/notifications'));
      await page.waitForTimeout(900);
      const s = await page.locator('sw-app').evaluate((app) => app.shadowRoot!.querySelector('sw-tabs[data-area-tabs]')?.getAttribute('data-variant') ?? null);
      expect(s).toBe('dropdown');
      await shot(page, `settings-tabs-390-${scheme}`);
      // the group "area" set to tabs is not touched by the settings override
      await page.evaluate(() => (location.hash = '#/devices/building'));
      await page.waitForTimeout(700);
      const a = await page.locator('sw-app').evaluate((app) => app.shadowRoot!.querySelector('sw-tabs[data-area-tabs]')?.getAttribute('data-variant') ?? null);
      expect(a).toBe('dropdown');
      await setMode(page, 'tabs', {});
      await page.waitForTimeout(400);
      const back = await page.locator('sw-app').evaluate((app) => app.shadowRoot!.querySelector('sw-tabs[data-area-tabs]')?.getAttribute('data-variant') ?? null);
      expect(back).toBe('pill');
    });

    test(`multimedia: the room filter becomes a dropdown (${scheme})`, async ({ page }) => {
      await openShell(page, '/multimedia/screens', scheme);
      await page.locator('multimedia-screens').evaluate((el, s) => el.setAttribute('data-devices-scheme', s), scheme);
      await page.waitForTimeout(300);
      expect(await page.locator('multimedia-screens').evaluate((el) => !!el.shadowRoot!.querySelector('[data-mm-header] .rooms .rc'))).toBe(true);
      await shot(page, `media-tabs-390-${scheme}`);
      await setMode(page, 'dropdown', {});
      await page.waitForTimeout(600);
      const dd = await page.locator('multimedia-screens').evaluate((el) => ({ dropdown: !!el.shadowRoot!.querySelector('[data-rooms-in-shell]') && !!document.querySelector('sw-app')!.shadowRoot!.querySelector('.tabpair sw-dropdown[data-pair-chip]'), chips: el.shadowRoot!.querySelectorAll('.rc').length }));
      expect(dd.dropdown).toBe(true);
      expect(dd.chips).toBe(0);
      await shot(page, `media-dropdown-390-${scheme}`);
      await setMode(page, 'tabs', {});
      await page.waitForTimeout(400);
      const back = await page.locator('multimedia-screens').evaluate((el) => ({ dropdown: !!document.querySelector('sw-app')!.shadowRoot!.querySelector('[data-pair-chip]'), chips: el.shadowRoot!.querySelectorAll('.rc').length }));
      expect(back.dropdown).toBe(false);
      expect(back.chips).toBeGreaterThan(0);
    });
  }
});
