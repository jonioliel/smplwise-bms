import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// CR-021 S3 (update and restarts UI) against the REAL backend with the fake Supervisor (tests/fixtures/update_fixture_backend.py): the
// real routes, the real state machine and workers, the real permission and audit paths; only the infrastructure is fake and the "new
// process" of an update is simulated by running the same start-up hook (the control server, see the fixture's docstring).
// One backend per Playwright project (fresh data dir and ports). Needs the built UI and a Python with the backend's requirements:
//   cd frontend && npm run build
//   SW_UPDATE_FIXTURE_PY=<venv python> npx playwright test tests/evidence-system-update-fixture.spec.ts --workers=1
// (run_remote.sh preview builds first). Skipped without SW_UPDATE_FIXTURE_PY. Never contacts a real system.
const PY = process.env.SW_UPDATE_FIXTURE_PY;
const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/update_fixture_backend.py');

test.skip(!PY, 'needs the fixture backend (SW_UPDATE_FIXTURE_PY=<python of the backend venv>)');
test.describe.configure({ mode: 'serial' });
test.use({ serviceWorkers: 'block' });

let child: ChildProcess | null = null;
let ORIGIN = '';
let CONTROL = '';
let output = '';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(p));
    });
    s.on('error', reject);
  });
}

async function control(pathname: string, body?: unknown) {
  const res = await fetch(`${CONTROL}${pathname}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect(res.status, `${pathname} ${await res.clone().text()}`).toBe(200);
  return (await res.json()) as Record<string, unknown>;
}

test.beforeAll(async () => {
  const port = await freePort();
  const ctl = await freePort();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'update-fixture-'));
  ORIGIN = `http://127.0.0.1:${port}`;
  CONTROL = `http://127.0.0.1:${ctl}`;
  child = spawn(PY!, [FIXTURE], { env: { ...process.env, SW_PORT: String(port), SW_CONTROL_PORT: String(ctl), SW_DATA_DIR: data }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', (d) => (output += String(d)));
  child.stderr?.on('data', (d) => (output += String(d)));
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`the fixture backend exited: ${output.slice(-1500)}`);
    try {
      const r = await fetch(`${ORIGIN}/api/v1/me`);
      if (r.status === 200) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`the fixture backend did not start: ${output.slice(-1500)}`);
    await new Promise((r) => setTimeout(r, 500));
  }
});

test.afterAll(() => {
  child?.kill(); // only the process this spec started
  child = null;
});

const root = (page: Page) => page.locator('system-update');
const run = (page: Page) => page.locator('system-update sw-update-run');
const card = (page: Page) => page.locator('system-update sw-restarts-card');

async function openPage(page: Page) {
  await page.goto(`${ORIGIN}/#/system/update`);
  await page.waitForSelector('sw-app');
  await expect(root(page).locator('[data-update-installed]')).toBeVisible({ timeout: 30_000 });
}

test('the real state: the running version, a check against the fake store, the apply button appears with a new version', async ({ page }) => {
  const info = await control('/fixture/log');
  await openPage(page);
  await expect(root(page).locator('[data-update-installed]')).toHaveText(String(info.version));
  await root(page).locator('[data-update-check]').click();
  await expect(root(page).locator('[data-update-status="current"]')).toBeVisible({ timeout: 20_000 });
  await expect(root(page).locator('[data-update-apply]')).toHaveCount(0);
  await expect(card(page).locator('[data-restart-platform]')).toBeVisible();
  await control('/fixture/set', { latest: '0.1.157', store_stale: false });
  await root(page).locator('[data-update-check]').click();
  await expect(root(page).locator('[data-update-status="available"]')).toBeVisible({ timeout: 20_000 });
  await expect(root(page).locator('[data-update-latest]')).toHaveText('0.1.157');
  await expect(root(page).locator('[data-update-apply]')).toBeVisible();
  await control('/fixture/set', { latest: String(info.version) });
});

test('platform restart, end to end: configuration check, restart, the platform returns, the outcome', async ({ page }) => {
  await control('/fixture/set', { core_check_status: 200, core_restart_status: 200, core_down_polls: 1 });
  await openPage(page);
  await card(page).locator('[data-restart-platform]').click();
  await card(page).locator('[data-restart-confirm]').click();
  await expect(run(page)).toBeVisible();
  await expect(run(page).locator('[data-run-state="succeeded"]')).toBeVisible({ timeout: 60_000 });
  await expect(run(page).locator('[data-run-outcome]')).toHaveText('תשתית המערכת הופעלה מחדש');
  const log = (await control('/fixture/log')).log as [string, string][];
  expect(log.filter(([m, p]) => m === 'POST' && p === '/core/check').length).toBeGreaterThan(0);
  expect(log.filter(([m, p]) => m === 'POST' && p === '/core/restart').length).toBe(1);
  await run(page).locator('[data-run-continue]').click();
  await expect(root(page).locator('[data-update-installed]')).toBeVisible();
});

test('platform restart with an invalid configuration: no restart, the failure is the run state in plain language, no upstream text', async ({ page }) => {
  await control('/fixture/set', { core_check_status: 400 });
  const before = ((await control('/fixture/log')).log as [string, string][]).filter(([m, p]) => m === 'POST' && p === '/core/restart').length;
  await openPage(page);
  await card(page).locator('[data-restart-platform]').click();
  await card(page).locator('[data-restart-confirm]').click();
  const out = run(page).locator('[data-run-state="failed"]');
  await expect(out).toBeVisible({ timeout: 60_000 });
  await expect(out).toHaveAttribute('data-run-error', 'platform_config_invalid');
  await expect(out.locator('[data-run-reason]')).toContainText('בדיקת התצורה של תשתית המערכת נכשלה');
  expect((await out.textContent()) ?? '').not.toMatch(/secret detail|Invalid config/);
  const after = ((await control('/fixture/log')).log as [string, string][]).filter(([m, p]) => m === 'POST' && p === '/core/restart').length;
  expect(after).toBe(before);
  await run(page).locator('[data-run-close]').click();
  await control('/fixture/set', { core_check_status: 200 });
});

test('the update, end to end: backup, job, the new process, the health check, the page reloads and shows the result', async ({ page }) => {
  const info = await control('/fixture/log');
  await control('/fixture/set', { latest: '0.1.157', installed: String(info.version), update_job: true, job_done: false, job_backup_done: false, store_stale: false });
  await openPage(page);
  await root(page).locator('[data-update-check]').click();
  await expect(root(page).locator('[data-update-apply]')).toBeVisible({ timeout: 20_000 });
  await root(page).locator('[data-update-apply]').click();
  await expect(root(page).locator('[data-update-backup]')).toBeChecked();
  await root(page).locator('[data-update-confirm]').click();
  await expect(run(page)).toBeVisible();
  await expect(run(page).locator('[data-run-step="backup"]')).toHaveAttribute('data-run-step-state', 'current', { timeout: 20_000 });
  await control('/fixture/set', { job_backup_done: true });
  await expect(run(page).locator('[data-run-step="install"]')).toHaveAttribute('data-run-step-state', 'current', { timeout: 20_000 });
  await control('/fixture/set', { job_done: true });
  await expect(run(page).locator('[data-run-step="restart"]')).toHaveAttribute('data-run-step-state', 'current', { timeout: 20_000 });
  let loads = 0;
  page.on('load', () => (loads += 1));
  const started = await control('/fixture/new-process', { version: '0.1.157' });
  expect(started.outcome).toBe('verifying');
  await expect.poll(() => loads, { timeout: 60_000 }).toBe(1); // the page loads the new bundle once
  await expect(run(page).locator('[data-run-state="succeeded"]')).toBeVisible({ timeout: 30_000 });
  await expect(run(page).locator('[data-run-outcome]')).toContainText('המערכת עודכנה לגרסה 0.1.157');
  await run(page).locator('[data-run-continue]').click();
  await expect(root(page).locator('[data-update-installed]')).toHaveText('0.1.157');
  await expect(root(page).locator('[data-update-apply]')).toHaveCount(0);
  const log = (await control('/fixture/log')).log as [string, string][];
  expect(log.filter(([m, p]) => m === 'POST' && /^\/store\/addons\/[^/]+\/update$/.test(p)).length).toBe(1);
});

test('an update that comes back on the same version: "version unchanged" with the rollback guidance', async ({ page }) => {
  await control('/fixture/set', { latest: '0.1.158', installed: '0.1.157', update_job: true, job_done: true, job_backup_done: true, store_stale: false, no_job_grace_s: 2 });
  await openPage(page);
  await root(page).locator('[data-update-check]').click();
  await expect(root(page).locator('[data-update-apply]')).toBeVisible({ timeout: 20_000 });
  await root(page).locator('[data-update-apply]').click();
  await root(page).locator('[data-update-confirm]').click();
  await expect(run(page).locator('[data-run-step="restart"]')).toHaveAttribute('data-run-step-state', 'current', { timeout: 20_000 });
  const started = await control('/fixture/new-process', { version: '0.1.157' });
  expect(started.outcome).toBe('resumed'); // the job decides, not the start: no update job for the (shortened) grace and the old version installed
  const out = run(page).locator('[data-run-state="failed"]');
  await expect(out).toBeVisible({ timeout: 20_000 });
  await expect(out).toHaveAttribute('data-run-error', 'version_unchanged');
  await run(page).locator('[data-run-guidance-open]').click();
  await expect(run(page).locator('[data-run-guidance] li')).toHaveCount(3);
  await run(page).locator('[data-run-close]').click();
  await control('/fixture/set', { no_job_grace_s: 120 });
});

test('a role that is still the default: the infrastructure refuses the update, the run fails in plain language and the page then shows the one-time step', async ({ page }) => {
  await control('/fixture/set', { role: 'default', latest: '0.1.159', installed: '0.1.157', update_job: true });
  await openPage(page);
  await root(page).locator('[data-update-check]').click(); // the store refresh is refused, the read works: the new version is still shown
  await expect(root(page).locator('[data-update-apply]')).toBeVisible({ timeout: 20_000 });
  await root(page).locator('[data-update-apply]').click();
  await root(page).locator('[data-update-confirm]').click();
  const out = run(page).locator('[data-run-state="failed"]');
  await expect(out).toBeVisible({ timeout: 30_000 });
  await expect(out).toHaveAttribute('data-run-error', 'platform_not_permitted');
  await expect(out.locator('[data-run-reason]')).toContainText('ל-Arx אין הרשאה לעדכן את עצמו');
  await run(page).locator('[data-run-close]').click();
  await expect(root(page).locator('[data-update-blocked]')).toBeVisible({ timeout: 20_000 });
  await control('/fixture/set', { role: 'manager' });
});

