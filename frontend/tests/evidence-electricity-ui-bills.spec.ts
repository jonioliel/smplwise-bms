import { test, expect } from '@playwright/test';
import { EL, noOverflow, open, screen, shot, watchErrors, type Ctl } from './electricity-ui';
import { wizardTo } from './electricity-wizard-helpers';

// Evidence for the electricity accounts / bills / customers / billing-settings screens (CR-023 P4 part 2): every screen of the approved mockup
// in the three widths of the Playwright projects, from the mock layer (invented data, no backend), screenshots into
// docs/design/evidence/electricity-ui-bills/. Needs the Vite DEV server (the harness page is served from /tests/electricity-harness/).
const A1 = 'a1';
const SCREENS: { name: string; route: string; screen: string; state?: string; ctl?: Ctl; act?: (p: import('@playwright/test').Page) => Promise<void> }[] = [
  { name: 'accounts-table', route: `${EL}/accounts`, screen: 'accounts' },
  { name: 'accounts-empty', route: `${EL}/accounts`, screen: 'accounts', state: 'empty', ctl: { empty: true } },
  { name: 'accounts-error', route: `${EL}/accounts`, screen: 'accounts', state: 'error', ctl: { fail: 'accounts' } },
  { name: 'accounts-view-only', route: `${EL}/accounts`, screen: 'accounts', ctl: { persona: 'view' } },
  { name: 'account-status', route: `${EL}/accounts/${A1}`, screen: 'account' },
  { name: 'account-status-stale', route: `${EL}/accounts/a3`, screen: 'account' },
  { name: 'account-status-view-only', route: `${EL}/accounts/${A1}`, screen: 'account', ctl: { persona: 'view' } },
  { name: 'account-history', route: `${EL}/accounts/${A1}/history`, screen: 'account' },
  { name: 'account-history-partial', route: `${EL}/accounts/a5/history`, screen: 'account' },
  { name: 'account-history-billed-only', route: `${EL}/accounts/a4/history`, screen: 'account' },
  // an account without an ended period (a new one, first period from today): the empty history
  {
    name: 'account-history-none',
    route: `${EL}/accounts/new`,
    screen: 'account',
    act: async (p) => {
      await wizardTo(p, 6, { name: 'חשבון בלי עבר' });
      await p.locator('[data-save]').click();
      await screen(p, 'account');
      await p.locator('[data-tab="history"]').click();
      await p.locator('[data-elec-state="empty"]').waitFor();
    },
  },
  { name: 'account-bills', route: `${EL}/accounts/${A1}/bills`, screen: 'account' },
  { name: 'wizard-1', route: `${EL}/accounts/new`, screen: 'wizard' },
  { name: 'bills-list', route: `${EL}/bills`, screen: 'bills' },
  { name: 'bills-empty', route: `${EL}/bills`, screen: 'bills', state: 'empty', ctl: { empty: true } },
  { name: 'bills-forbidden', route: `${EL}/bills`, screen: 'bills', state: 'forbidden', ctl: { persona: 'view' } },
  { name: 'bill-issued', route: `${EL}/bills/b104`, screen: 'bill' },
  { name: 'bill-sent', route: `${EL}/bills/b102`, screen: 'bill' },
  { name: 'bill-paid', route: `${EL}/bills/b103`, screen: 'bill' },
  { name: 'bill-draft', route: `${EL}/bills/b101`, screen: 'bill' },
  { name: 'bill-void', route: `${EL}/bills/b105`, screen: 'bill' },
  { name: 'bill-revision', route: `${EL}/bills/b106`, screen: 'bill' },
  { name: 'customers-list', route: `${EL}/customers`, screen: 'customers' },
  { name: 'customer-card', route: `${EL}/customers/c2`, screen: 'customers' },
  { name: 'customers-forbidden', route: `${EL}/customers`, screen: 'customers', state: 'forbidden', ctl: { persona: 'view' } },
  { name: 'settings-prices', route: '/system/infra/prices', screen: 'settings-prices' },
  { name: 'settings-business', route: '/system/infra/business', screen: 'settings-business' },
];

test.describe('electricity evidence (mock layer)', () => {
  for (const s of SCREENS) {
    test(s.name, async ({ page }, info) => {
      const errs = watchErrors(page);
      await open(page, s.route, { ctl: s.ctl });
      if (s.act) await s.act(page);
      await screen(page, s.screen, s.state ?? 'ready');
      await shot(page, info, s.name);
      await noOverflow(page);
      expect(await page.locator('[data-harness]').count()).toBe(1);
      errs.expectNone();
    });
  }
});
