import { test, expect, type Page } from '@playwright/test';
import { installWaterMock, waterUrl } from './wkwater-mocks';

// PHONE-SHEET-2480: the open sw-sheet on a phone (390 px) - one project only (mobile). Found while capturing question N55 for the owner: the
// water tariff's "new version" sheet was 72-80 % opaque with NO blur in the skins without a sheet blur (classic, infra, soft, tesla), because
// the look dial writes --sw-sheet-alpha on <html> for every skin; the page's figures and the phone's bottom bar (under the sheet's action
// row) read through it. What it pins, against the mocked water backend (tests/wkwater-mocks.ts, invented data):
//   - a skin without a sheet blur rests the sheet opaque (alpha 1) at the default transparency dial;
//   - the module form dialog (elec-dialog, shared by water and electricity) is `solid`: opaque in a glass skin too (domus);
//   - a non-form sheet in a glass skin keeps its frosted glass (the skin's look: alpha below 1 and a backdrop blur);
//   - the action row sits on the sheet, above the bottom bar: the sheet is stacked over the bar and each action is the top element at its
//     own centre; the sheet keeps the safe-area padding at its bottom edge.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-phone-sheet-2480.spec.ts --project=mobile

test.describe.configure({ timeout: 180_000 });

interface Probe {
  alpha: number;
  blur: string;
  sheetZ: number;
  navZ: number;
  navTop: number;
  sheetBottom: number;
  padEnd: string;
  hits: { text: string; onTop: boolean; inNavBand: boolean }[];
}

async function probe(page: Page, sel: string): Promise<Probe> {
  return page.locator(sel).evaluate((host) => {
    const sec = host.shadowRoot!.querySelector('.sheet')!;
    const st = getComputedStyle(sec);
    const m = /rgba?\(([^)]+)\)/.exec(st.backgroundColor);
    const parts = m ? m[1].split(',').map((x) => parseFloat(x)) : [];
    const nav = document.querySelector('sw-app')!.shadowRoot!.querySelector('nav.bottom')!;
    const nr = nav.getBoundingClientRect();
    // the action buttons: an elec-dialog slots them into the sheet footer through its own `actions` slot
    const outer = (host.getRootNode() as ShadowRoot).host;
    const buttons = Array.from(outer?.querySelectorAll('sw-button[slot="actions"]') ?? []);
    const hits = buttons.map((b) => {
      const r = b.getBoundingClientRect();
      const x = (r.left + r.right) / 2;
      const y = (r.top + r.bottom) / 2;
      // the top element at the button's centre, drilled through the shadow roots (document.elementFromPoint stops at the shell's host)
      const chain: Element[] = [];
      let el: Element | null = document.elementFromPoint(x, y);
      while (el) {
        chain.push(el);
        const inner: Element | null = el.shadowRoot ? el.shadowRoot.elementFromPoint(x, y) : null;
        if (!inner || inner === el) break;
        el = inner;
      }
      return { text: (b.textContent ?? '').trim(), onTop: chain.includes(b) && !chain.includes(nav), inNavBand: r.bottom > nr.top };
    });
    return {
      alpha: parts.length > 3 ? parts[3] : 1, blur: st.backdropFilter, sheetZ: Number(st.zIndex), navZ: Number(getComputedStyle(nav).zIndex) || 0, navTop: nr.top,
      sheetBottom: sec.getBoundingClientRect().bottom, padEnd: st.paddingBlockEnd, hits,
    };
  });
}

async function openVersion(page: Page, skin: string, scheme: 'light' | 'dark') {
  await installWaterMock(page);
  await page.goto('about:blank');
  await page.goto(waterUrl('/infra/water/settings?set=prices', skin, scheme));
  await expect(page.locator('[data-water="settings"][data-state="ready"]').first()).toBeVisible({ timeout: 90_000 });
  await page.locator('[data-new-version]').first().click();
  await expect(page.locator('elec-dialog[data-dialog="version"]')).toBeVisible();
  await page.waitForTimeout(700); // the sheet lands (spring)
}

test.describe('PHONE-SHEET-2480: the phone sheet surface and its action row', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'mobile', 'one project only (mobile)'));

  for (const scheme of ['light', 'dark'] as const) {
    for (const skin of ['classic', 'tesla', 'domus'] as const) {
      test(`water "new version" sheet: ${skin} ${scheme}`, async ({ page }) => {
        await openVersion(page, skin, scheme);
        const p = await probe(page, 'elec-dialog[data-dialog="version"] >> sw-sheet');
        // opaque: the form dialog is solid in every skin, and a skin without a sheet blur never rests translucent anyway
        expect(p.alpha, `${skin}/${scheme} sheet alpha`).toBe(1);
        expect(p.sheetZ, 'the sheet is stacked over the bottom bar').toBeGreaterThan(p.navZ);
        expect(p.sheetBottom).toBeLessThanOrEqual(page.viewportSize()!.height + 0.5);
        expect(p.padEnd, 'the safe-area padding at the bottom edge').toMatch(/px$/);
        expect(p.hits.length).toBe(2);
        for (const h of p.hits) expect(h.onTop, `${h.text} is the top element at its centre`).toBe(true);
      });
    }
  }

  test('a non-form sheet in a glass skin keeps its frosted glass; the same sheet in classic is opaque', async ({ page }) => {
    for (const [skin, glass] of [['domus', true], ['classic', false]] as const) {
      await page.goto(`/?skin=${skin}&scheme=light&xsdemo=3&xs_syn_phone_view=cards#/devices/synoptic`);
      await page.locator('[data-syn-info]').click();
      const sheet = page.locator('sw-sheet[data-syn-info-sheet][open]');
      await expect(sheet).toHaveCount(1, { timeout: 60_000 });
      await page.waitForTimeout(700);
      const p = await probe(page, 'sw-sheet[data-syn-info-sheet][open]');
      if (glass) {
        expect(p.alpha, 'domus: the dial still reaches the glass sheet').toBeLessThan(1);
        expect(p.blur).toContain('blur(');
      } else {
        expect(p.alpha, 'classic: no blur, so opaque').toBe(1);
        expect(p.blur).toBe('none');
      }
    }
  });
});
