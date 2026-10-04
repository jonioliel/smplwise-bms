import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { ADMIN_PERMS, RUN_ID, freshMock, mockBackend, openUpdate, runView, withUpdate, type UpdateMock } from './update-run-mocks';

// CR-021 S3: the layout guard (tests/layout-guard.ts) over the update and restart screens, with the mocked backend, in every skin
// (classic, domus, tesla, bubble) x light / dark x widths 320..1440: the page with and without an update, the blocked state, the
// restart-required row, the apply dialog, the restart dialog, and the status screen in its states (running, waiting for the system,
// succeeded, failed with the rollback guidance open, a platform restart that failed its configuration check). FAILS on
// escape / overflow / floating / clipped / target. Works on the dist preview and on the Vite dev server (no /src imports).
//   LAYOUT_QUICK=1 sweeps four widths (the loop's setting); the full sweep runs once at the end.
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 800, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const SCHEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const BUBBLE = '.step, .row, .outcome, .chk, .wait';
// the shell's own section row and tab row (not this screen's), and the shared dialog's close button, are not measured
const SKIP = '.vh, nav.sections, nav.sectabs, .subnav, .tabpair, sw-tabs, header sw-button';

interface Scenario {
  name: string;
  setup: (m: UpdateMock) => void;
  act?: (page: Page) => Promise<void>;
}

const dialogOpen = async (page: Page, sel: string) => page.locator(sel).first().waitFor({ state: 'visible' });
const FINISHED = () => new Date().toISOString();
const openRun = (kind: 'update' | 'platform_restart', state: string) => ({ id: RUN_ID, kind, state, step: null, created_at: new Date().toISOString(), finished_at: null, from_version: '0.1.156', to_version: '0.1.157', error_code: null });

const SCENARIOS: Scenario[] = [
  { name: 'current', setup: () => undefined },
  { name: 'available', setup: (m) => void withUpdate(m, { notes: [{ version: '0.1.157', he: 'נוסף מסך עדכונים ואתחולים', en: 'Added the updates and restarts screen' }] }) },
  { name: 'blocked', setup: (m) => void withUpdate(m, { permitted: 'no', check_result: 'not_permitted' }), act: async (p) => void (await p.locator('system-update [data-update-manual-open]').click()) },
  { name: 'restart-required', setup: (m) => (m.state = { ...m.state, requires_platform_restart: true, platform_restart_reasons: [{ code: 'bridge', version: '1.2.3' }] }) },
  { name: 'apply-dialog', setup: (m) => void withUpdate(m), act: async (p) => { await p.locator('system-update [data-update-apply]').click(); await dialogOpen(p, 'system-update [data-update-dialog] [data-update-confirm]'); } },
  { name: 'restart-dialog', setup: () => undefined, act: async (p) => { await p.locator('system-update sw-restarts-card [data-restart-platform]').click(); await dialogOpen(p, 'system-update sw-restarts-card [data-restart-confirm]'); } },
  { name: 'run-updating', setup: (m) => { withUpdate(m, { run: openRun('update', 'updating') }); m.runReplies = [runView({ state: 'updating', step: 'job_running' })]; } },
  { name: 'run-waiting', setup: (m) => { withUpdate(m, { run: openRun('update', 'restarting') }); m.runReplies = ['down']; } },
  { name: 'run-verifying', setup: (m) => { withUpdate(m, { run: openRun('update', 'verifying') }); m.runReplies = [runView({ state: 'verifying', step: 'health_check' })]; } },
  { name: 'run-succeeded', setup: (m) => { m.runReplies = [runView({ state: 'succeeded', to_version: '0.1.156', finished_at: FINISHED() })]; }, },
  { name: 'run-failed-guidance', setup: (m) => { m.runReplies = [runView({ state: 'failed', error_code: 'restart_loop', finished_at: FINISHED() })]; }, act: async (p) => void (await p.locator('system-update [data-run-guidance-open]').click()) },
  { name: 'run-abandoned', setup: (m) => { m.runReplies = [runView({ state: 'abandoned', error_code: 'timeout', finished_at: FINISHED() })]; } },
  { name: 'run-platform-failed', setup: (m) => { m.runReplies = [runView({ kind: 'platform_restart', state: 'failed', error_code: 'platform_config_invalid', finished_at: FINISHED() })]; } },
  { name: 'run-platform-running', setup: (m) => { m.state = { ...m.state, run: openRun('platform_restart', 'restarting') }; m.runReplies = [runView({ kind: 'platform_restart', state: 'restarting', step: 'restart_accepted' })]; } },
];

// the stored run id brings the finished-run scenarios up without a click
const NEEDS_STORED = new Set(['run-succeeded', 'run-failed-guidance', 'run-abandoned', 'run-platform-failed']);

function report(name: string, runs: number, results: Finding[], errors: string[]) {
  const { byCls, lines } = summarize(results);
  console.log(`${name}: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
  for (const l of lines) console.log('  ' + l);
  if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 10));
  expect(errors, 'page errors').toEqual([]);
  expect(lines, 'layout findings').toEqual([]);
}

test.describe('update and restart screens: the layout guard', () => {
  test.describe.configure({ timeout: 30 * 60_000 });
  for (const skin of SKINS) for (const scheme of SCHEMES) test(`${skin} / ${scheme}`, async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep (it resizes the viewport itself)');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const mock = freshMock();
    await mockBackend(page, ADMIN_PERMS, mock);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const sc of SCENARIOS) {
      Object.assign(mock, freshMock());
      sc.setup(mock);
      await page.setViewportSize({ width: 1440, height: 900 });
      await openUpdate(page, '/system/update', `&skin=${skin}&scheme=${scheme}`);
      await page.evaluate(([stored, id]) => {
        sessionStorage.clear();
        if (stored) sessionStorage.setItem('sw.update.run', id as string);
      }, [NEEDS_STORED.has(sc.name), RUN_ID] as const);
      await page.reload();
      await page.waitForSelector('sw-app');
      await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('system-update')?.shadowRoot?.querySelector('sw-card, sw-update-run'), null, { timeout: 20_000 });
      await page.waitForTimeout(500);
      if (sc.act) await sc.act(page);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: height(w) });
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        runs++;
        const found = await page.evaluate(inPageCheck, { ctx: `${sc.name} ${skin} ${scheme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: ['system-update'] });
        // the desktop touch dial (44 px above 1100 px) belongs to the bubble skin; the settings screens of the other skins keep the 26-36 px desktop buttons
        results.push(...found.filter((f) => !(f.cls === 'target' && w > 1100 && skin !== 'bubble')));
      }
    }
    report(`layout-update-screens ${skin}/${scheme}`, runs, results, errors);
  });
});
