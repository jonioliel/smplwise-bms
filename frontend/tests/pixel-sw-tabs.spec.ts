import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// CR-CMP2-TABS-2460: the tab strip `sw-tabs` with what the strips that moved to it needed - a count pill per item, the screen's icon,
// the full-width row (`fill`) and the controlled mode - plus sw-chip-choice's icon / count / multi rows. A specimen sheet drawn with the
// app's tokens, light and dark, classic skin, demo fixtures; the screens that adopted them are pinned by their own shots.
// Titles carry "pixel-stable" (the gate's pixel lane). Baselines are per OS: the Linux ones are generated on the runner with
// --update-snapshots, looked at, then committed; on an OS without a baseline the check is skipped instead of failing on a missing file.
//   run_smart.py preview <branch> tests/pixel-sw-tabs.spec.ts --project=desktop --project=mobile -u --workers=1 --machine runner

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

type Win = Window & { tabsSeen: string[]; chipsSeen: { value: string; pressed?: boolean }[] };

async function specimen(page: Page, scheme: 'light' | 'dark') {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  // the events centre loads both elements (sw-tabs is the shell's; its chip rows are sw-chip-choice); the sheet covers the screen
  await page.goto(`/?design=a&fit=off&look=performance:full&skin=classic&scheme=${scheme}#/investigate/events`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!customElements.get('sw-tabs') && !!customElements.get('sw-chip-choice'), undefined, { timeout: 30_000 });
  await page.evaluate(() => {
    type Item = { id: string; label: string; count?: number; pill?: number | string; glyph?: unknown; attrs?: Record<string, string> };
    const w = window as unknown as Win;
    w.tabsSeen = [];
    w.chipsSeen = [];
    const sheet = document.createElement('div');
    sheet.setAttribute('data-tabs-specimen', '');
    sheet.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;overflow:hidden;padding:24px 16px;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;' +
      'align-items:flex-start;background:var(--sw-surface);color:var(--sw-text);font-family:var(--sw-font, inherit);';
    const icon = (name: string) => {
      const i = document.createElement('sw-icon');
      i.setAttribute('name', name);
      i.setAttribute('size', '15');
      return i;
    };
    const box = (width: string) => {
      const b = document.createElement('div');
      b.style.cssText = `inline-size:min(100%, ${width});display:flex`;
      sheet.append(b);
      return b;
    };
    const tabs = (items: Item[], active: string, attrs: Record<string, string> = {}, into: HTMLElement = sheet) => {
      const el = document.createElement('sw-tabs') as unknown as HTMLElement & { items: Item[]; active: string };
      el.items = items;
      el.active = active;
      el.setAttribute('variant', 'pill');
      el.setAttribute('group-label', 'specimen');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      el.addEventListener('change', (e) => w.tabsSeen.push((e as CustomEvent<{ id: string }>).detail.id));
      into.append(el);
      return el;
    };
    // 1. the kinds: count pills (0 included), one without a count
    const kinds: Item[] = [
      { id: 'schedules', label: 'תזמונים', pill: 7, attrs: { 'data-spec-tab': 'schedules' } },
      { id: 'automations', label: 'אוטומציות', pill: 12, attrs: { 'data-spec-tab': 'automations' } },
      { id: 'scenes', label: 'סצנות', pill: 0, attrs: { 'data-spec-tab': 'scenes' } },
      { id: 'scenarios', label: 'תרחישים', attrs: { 'data-spec-tab': 'scenarios' } },
    ];
    tabs(kinds, 'automations', { controlled: '', 'data-spec-strip': 'kinds' });
    // 2. icons and a short figure ("1/3") in a box the bar fills
    tabs(
      [
        { id: 'devices', label: 'התקנים', glyph: icon('sensor'), pill: 14 },
        { id: 'cameras', label: 'מצלמות', glyph: icon('camera'), pill: '1/3' },
      ],
      'devices',
      { fill: 'always', 'data-spec-strip': 'fill' },
      box('360px'),
    );
    // 3. three tabs filling a phone-wide box (the remote's pad / sources / apps)
    tabs([{ id: 'pad', label: 'שלט' }, { id: 'sources', label: 'מקורות' }, { id: 'apps', label: 'אפליקציות' }], 'sources', { fill: 'always' }, box('340px'));
    // 4. a state word in the pill (the receiver's second zone) beside the quiet (n) count of the settings tabs
    tabs([{ id: 'main', label: 'ראשי' }, { id: 'z2', label: 'אזור 2', pill: 'כבוי' }, { id: 'set', label: 'הגדרות', count: 3 }], 'z2');
    // 5. a row too long for its box still scrolls sideways under fill (a tab never narrower than its label)
    tabs(
      ['אוטומציות', 'סצנות', 'סקריפטים', 'תרחישים', 'תזמונים', 'היסטוריה', 'הגדרות'].map((l, i) => ({ id: `t${i}`, label: l, pill: i * 3 })),
      't0',
      { fill: 'always', 'data-spec-strip': 'long' },
      box('300px'),
    );
    // sw-chip-choice: icons and counts (the events centre), a multi row (the summary tiles)
    const chips = (opts: unknown[], attrs: Record<string, string>, set: (el: HTMLElement & Record<string, unknown>) => void) => {
      const el = document.createElement('sw-chip-choice') as unknown as HTMLElement & Record<string, unknown>;
      el.options = opts;
      el.setAttribute('label', 'specimen chips');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      set(el);
      el.addEventListener('change', (e) => w.chipsSeen.push((e as CustomEvent<{ value: string; pressed?: boolean }>).detail));
      sheet.append(el);
    };
    chips(
      [
        { value: 'raw', label: 'אירועים', icon: icon('list') },
        { value: 'windows', label: 'חלונות', icon: icon('layers'), count: 18 },
      ],
      { 'data-spec-chips': 'one' },
      (el) => (el.value = 'windows'),
    );
    chips(
      [{ value: '', label: 'לפי ההתקנה' }, { value: 'cameras', label: 'מצלמות' }, { value: 'doors', label: 'דלתות' }, { value: 'alarms', label: 'אזעקות' }],
      { multi: '', 'data-spec-chips': 'multi' },
      (el) => (el.values = ['cameras', 'alarms']),
    );
    document.body.append(sheet);
  });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

test.describe('pixel: sw-tabs', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-fixture spec');

  for (const scheme of ['light', 'dark'] as const) {
    test(`sw-tabs specimen ${scheme} is pixel-stable`, async ({ page }, info) => {
      const file = `sw-tabs-${scheme}.png`; // Playwright adds -<project>-<platform>
      if (noBaseline(info, file)) {
        info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
        test.skip(true, `${file}: no baseline on ${process.platform}`);
      }
      await specimen(page, scheme);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
      await expect(page).toHaveScreenshot(file, { animations: 'disabled', maxDiffPixelRatio: 0.002 });
    });
  }

  test('sw-tabs behaviour: count pills, hooks on the tabs, the controlled strip waits for its host, fill shares the row', async ({ page }) => {
    await specimen(page, 'light');
    const sheet = page.locator('[data-tabs-specimen]');
    const kinds = sheet.locator('sw-tabs[data-spec-strip="kinds"]');
    // the count is a <small> pill inside the tab (the devices specs read it so); 0 is a count, no count draws no pill
    await expect(kinds.locator('[data-spec-tab="automations"] small')).toHaveText('12');
    await expect(kinds.locator('[data-spec-tab="scenes"] small')).toHaveText('0');
    await expect(kinds.locator('[data-spec-tab="scenarios"] small')).toHaveCount(0);
    // a real tablist with one Tab stop: the selected tab
    await expect(kinds.locator('[role="tablist"]')).toHaveAttribute('aria-label', 'specimen');
    await expect(kinds.locator('[role="tab"][tabindex="0"]')).toHaveAttribute('data-spec-tab', 'automations');
    // controlled: a press reports, the selected tab stays until the host sets it
    await kinds.locator('[data-spec-tab="scenes"]').click();
    expect(await page.evaluate(() => (window as unknown as Win).tabsSeen)).toEqual(['scenes']);
    await expect(kinds.locator('[data-spec-tab="automations"]')).toHaveAttribute('aria-selected', 'true');
    await expect(kinds.locator('[data-spec-tab="scenes"]')).toHaveAttribute('aria-selected', 'false');
    await kinds.evaluate((el) => ((el as HTMLElement & { active: string }).active = 'scenes'));
    await expect(kinds.locator('[data-spec-tab="scenes"]')).toHaveAttribute('aria-selected', 'true');
    // the arrows walk the tabs (RTL: ArrowLeft is the next one), Enter opens
    await kinds.locator('[data-spec-tab="scenes"]').focus();
    const rtl = await kinds.evaluate((el) => getComputedStyle(el).direction === 'rtl');
    await page.keyboard.press(rtl ? 'ArrowLeft' : 'ArrowRight');
    await expect(kinds.locator('[data-spec-tab="scenarios"]')).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as unknown as Win).tabsSeen)).toEqual(['scenes', 'scenarios']);
    // an uncontrolled strip moves by itself, as before
    const zones = sheet.locator('sw-tabs').nth(3);
    await zones.locator('[role="tab"]', { hasText: 'ראשי' }).click();
    await expect(zones.locator('[role="tab"]', { hasText: 'ראשי' })).toHaveAttribute('aria-selected', 'true');
    await expect(zones.locator('[role="tab"]', { hasText: 'אזור 2' }).locator('small')).toHaveText('כבוי');
    // fill: the bar spans its box and the tabs share it equally; the icon is decorative
    const fill = sheet.locator('sw-tabs[data-spec-strip="fill"]');
    const boxW = await fill.evaluate((el) => el.parentElement!.getBoundingClientRect().width);
    const hostW = await fill.evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.abs(hostW - boxW)).toBeLessThanOrEqual(1);
    const widths = await fill.locator('[role="tab"]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
    expect(widths).toHaveLength(2);
    expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1);
    await expect(fill.locator('[part="glyph"]').first()).toHaveAttribute('aria-hidden', 'true');
    await expect(fill.locator('[role="tab"]').nth(1).locator('small')).toHaveText('1/3');
    // a long row under fill keeps its labels whole and scrolls sideways inside its own box (never the page)
    const long = sheet.locator('sw-tabs[data-spec-strip="long"]');
    const vp = await long.evaluate((el) => {
      const v = el.shadowRoot!.querySelector('.vp') as HTMLElement;
      return { scroll: v.scrollWidth, client: v.clientWidth };
    });
    expect(vp.scroll).toBeGreaterThan(vp.client);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('sw-chip-choice: an icon and a count on a chip; multi asks for the opposite state and waits for its host', async ({ page }) => {
    await specimen(page, 'light');
    const one = page.locator('[data-tabs-specimen] sw-chip-choice[data-spec-chips="one"]');
    await expect(one.locator('button[aria-pressed="true"] [part="count"]')).toHaveText('18');
    await expect(one.locator('[part="icon"]')).toHaveCount(2);
    const multi = page.locator('[data-tabs-specimen] sw-chip-choice[data-spec-chips="multi"]');
    await expect(multi.locator('button[aria-pressed="true"]')).toHaveCount(2);
    await multi.locator('button', { hasText: 'דלתות' }).click();
    await multi.locator('button', { hasText: 'מצלמות' }).click();
    expect(await page.evaluate(() => (window as unknown as Win).chipsSeen)).toEqual([
      { value: 'doors', pressed: true },
      { value: 'cameras', pressed: false },
    ]);
    // controlled: nothing moved until the host sets the values
    await expect(multi.locator('button[aria-pressed="true"]')).toHaveCount(2);
    await multi.evaluate((el) => ((el as HTMLElement & { values: string[] }).values = ['doors', 'alarms']));
    await expect(multi.locator('button', { hasText: 'דלתות' })).toHaveAttribute('aria-pressed', 'true');
    await expect(multi.locator('button', { hasText: 'מצלמות' })).toHaveAttribute('aria-pressed', 'false');
    await expect(multi.locator('[role="group"]')).toHaveAttribute('aria-label', 'specimen chips');
  });
});
