import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { EL, open, type Ctl } from './electricity-ui';
import { wizardTo } from './electricity-wizard-helpers';

// The layout guard (tests/layout-guard.ts, the Bubble foundation's) over the electricity accounts / bills / customers / billing-settings screens, in all four
// skins x light and dark x widths 320..1440, with the wizard steps and the dialogs open. FAILS on escape / overflow / floating / clipped / target
// findings and on page errors. Needs the Vite DEV server. LAYOUT_QUICK=1 sweeps four widths (the working loop); the full run is the gate.
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

// the bubbles of these screens beyond the shared set; the bill paper is a print preview (its own fixed A4 look) and is not measured
const BUBBLE = '.card, .tile, .li, .preset, .tok, .alert, .dlg, .drawer, .expr, .menu .pop';
const SKIP = 'elec-bill-paper, .sr, .skl, input[type="file"]';

interface Screen {
  name: string;
  route: string;
  ctl?: Ctl;
  prep?: (p: Page) => Promise<void>;
}
const click = (sel: string) => async (p: Page) => void (await p.locator(sel).first().click());
const SCREENS: Screen[] = [
  { name: 'accounts', route: `${EL}/accounts` },
  { name: 'accounts-empty', route: `${EL}/accounts`, ctl: { empty: true } },
  { name: 'accounts-error', route: `${EL}/accounts`, ctl: { fail: 'accounts' } },
  { name: 'accounts-view-only', route: `${EL}/accounts`, ctl: { persona: 'view' } },
  { name: 'account-status', route: `${EL}/accounts/a1` },
  { name: 'account-stale', route: `${EL}/accounts/a3` },
  { name: 'account-history', route: `${EL}/accounts/a1/history`, prep: click('elec-chart summary') },
  { name: 'account-history-partial', route: `${EL}/accounts/a2/history` },
  { name: 'account-bills', route: `${EL}/accounts/a1/bills` },
  { name: 'generate-dialog', route: `${EL}/accounts/a1`, prep: click('[data-create-bill]') },
  { name: 'wizard-1', route: `${EL}/accounts/new` },
  { name: 'wizard-2', route: `${EL}/accounts/new`, prep: (p) => wizardTo(p, 2) },
  { name: 'wizard-2-number-dialog', route: `${EL}/accounts/new`, prep: async (p) => { await wizardTo(p, 2); await p.locator('[data-number-btn]').click(); } },
  { name: 'wizard-2-menu', route: `${EL}/accounts/new`, prep: async (p) => { await wizardTo(p, 2); await p.locator('[data-add-meter]').click(); } },
  { name: 'wizard-2-text', route: `${EL}/accounts/new`, prep: async (p) => { await wizardTo(p, 2); await p.locator('[data-mode="text"]').click(); } },
  { name: 'wizard-2-negative', route: `${EL}/accounts/new`, prep: async (p) => { await wizardTo(p, 2); await p.locator('[data-preset-btn="mainsub"]').click(); await p.locator('[data-preset-main]').selectOption('m3'); } },
  { name: 'wizard-3', route: `${EL}/accounts/new`, prep: async (p) => { await wizardTo(p, 3); await p.locator('[data-tariff-row="t2"]').click(); } },
  { name: 'wizard-4-bimonthly', route: `${EL}/accounts/new`, prep: async (p) => { await wizardTo(p, 4); await p.locator('[data-months="2"]').click(); } },
  { name: 'wizard-5', route: `${EL}/accounts/new`, prep: async (p) => { await wizardTo(p, 5); await p.locator('[data-next]').click(); } },
  { name: 'wizard-5-existing', route: `${EL}/accounts/new`, prep: async (p) => { await wizardTo(p, 5); await p.locator('[data-cust-mode="existing"]').click(); await p.locator('[data-cust-row="c2"]').click(); } },
  { name: 'wizard-6', route: `${EL}/accounts/new`, prep: async (p) => { await wizardTo(p, 6); await p.locator('[data-opt="issue"]').click(); } },
  { name: 'bills', route: `${EL}/bills` },
  { name: 'bills-empty', route: `${EL}/bills`, ctl: { empty: true } },
  { name: 'bill-draft', route: `${EL}/bills/b101` },
  { name: 'bill-issued', route: `${EL}/bills/b104`, ctl: { pdf_failed: true }, prep: click('[data-act="pdf"]') },
  { name: 'bill-void', route: `${EL}/bills/b105` },
  { name: 'bill-revision', route: `${EL}/bills/b106` },
  { name: 'dialog-issue', route: `${EL}/bills/b101`, prep: click('[data-act="issue"]') },
  { name: 'dialog-void', route: `${EL}/bills/b104`, prep: click('[data-act="void"]') },
  { name: 'dialog-correct', route: `${EL}/bills/b103`, prep: click('[data-act="correct"]') },
  { name: 'dialog-sent', route: `${EL}/bills/b104`, prep: click('[data-act="sent"]') },
  { name: 'dialog-paid', route: `${EL}/bills/b102`, prep: click('[data-act="paid"]') },
  { name: 'customers', route: `${EL}/customers` },
  { name: 'customer-card', route: `${EL}/customers/c2` },
  { name: 'customer-new', route: `${EL}/customers/new`, prep: click('[data-customer-card] [data-save]') },
  { name: 'settings-prices', route: '/system/infra/prices' },
  { name: 'settings-tariff-dialog', route: '/system/infra/prices', prep: click('[data-tariff-row="t1"]') },
  { name: 'settings-vat-dialog', route: '/system/infra/prices', prep: click('[data-new-vat]') },
  { name: 'settings-business', route: '/system/infra/business' },
];

test.describe('electricity layout guard', () => {
  test.describe.configure({ timeout: 40 * 60_000 });
  for (const skin of SKINS) {
    test(`all screens, widths and themes [${skin}]`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const results: Finding[] = [];
      let runs = 0;
      for (const theme of THEMES) {
        for (const s of SCREENS) {
          await page.setViewportSize({ width: 1440, height: 900 });
          await open(page, s.route, { skin, scheme: theme, ctl: s.ctl });
          await page.waitForSelector('[data-elec]');
          await page.waitForFunction(() => document.querySelector('[data-elec]')?.getAttribute('data-state') !== 'loading', null, { timeout: 20_000 });
          // the desktop touch dial: the guard asks 44 px by default (the bubble skin's look); the other skins keep their 32 px desktop controls
          await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
          if (s.prep) await s.prep(page);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
            await page.waitForTimeout(80);
            runs++;
            results.push(...(await page.evaluate(inPageCheck, { ctx: `${s.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: [] })));
          }
        }
      }
      const { byCls, lines } = summarize(results);
      console.log(`electricity layout [${skin}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
