import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// DATASTORE-295 phase 2: Settings › אבחון › גיבוי ושחזור - the off-box copies card, the encryption key and the restore drill, against a
// MOCKED wire contract of routers/backup_offbox.py and routers/backup.py (invented targets, no real host or key):
//   1. the targets show their last copy / test / drill; a failed one names its reason;
//   2. adding an S3 target sends the typed credentials once and never shows them again;
//   3. the key export needs EXPORT typed, shows the key once, and the export button is then disabled;
//   4. the connection test answers in words; the drill buttons start a drill;
//   5. OFFBOX-RESTORE-2300 (owner 2026-10-30): the restore scope default and the local safety backup are settings; the safety backup takes
//      its own optional password (sent once, never shown again; a weak one is refused in words naming the minimum); the dialog does not scroll.
//   SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/offbox-backup-ui.spec.ts --workers=2
// SW_SHOTS=1 also writes screenshots to docs/design/evidence/datastore-295 (nothing otherwise).

const SHOTS_OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/datastore-295');
async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(SHOTS_OUT, { recursive: true });
  await page.locator('sw-offbox-backup').screenshot({ path: path.join(SHOTS_OUT, `${name}-${test.info().project.name}.png`) });
}

const PERMS = ['video.live', 'map.read', 'entity.state.read', 'events.read', 'system.configure', 'backup.manage'];
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const apiErr = (route: Route, code: string, status = 422) => json(route, { code, user_message: code, retryable: false, correlation_id: 'mock', details: {} }, status);

const run = (action: string, ok: boolean, error: string | null = null) => ({
  id: 1, action, trigger: 'daily', started_at: '2026-10-20T03:00:00Z', finished_at: '2026-10-20T03:00:09Z', ok, error, object: ok ? 'auto-daily-20261020-030000.zip.swxb' : null,
  key_id: ok ? '3f2a9c1d7b6e5a40' : null, sealed_bytes: 1048576, verified: ok, deleted_count: 0,
});

interface Mock {
  calls: { method: string; path: string; body: unknown }[];
  targets: Record<string, unknown>[];
  exported: boolean;
  settings: Record<string, unknown>;
}

const LOCAL_BACKUP = { name: 'manual-20261020-030000.zip', bytes: 2097152, created_at: '2026-10-20T03:00:00Z', kind: 'manual', note: '', app_version: '2.27.2', valid: true,
  tables: { sites: 1, floors: 2 }, files: 3, sensitive: { state: 'omitted', counts: { password_hashes: 0, settings: 0 } } };
const SAFETY = { name: 'auto-pre-restore-20261030-120000.zip', bytes: 1048576, created_at: '2026-10-30T12:00:00Z' };

async function setup(page: Page): Promise<Mock> {
  const st: Mock = {
    calls: [], exported: false, settings: { 'ui.design': 'a', 'backup.password_min': 12 },
    targets: [
      { id: 't1', name: 'Cloudflare R2', kind: 's3', enabled: true, config: { endpoint: 'https://acc.r2.example.net', bucket: 'arx-bk', region: 'auto', prefix: 'arx-backups', path_style: true },
        secrets: { access_key: true, secret_key: true }, retention: { keep_last: 3, keep_daily: 7, keep_weekly: 4, keep_monthly: 6 }, revision: 2, updated_at: '2026-10-19T10:00:00Z',
        last: { push: run('push', true), test: run('test', true), drill: run('drill', true) } },
      { id: 't2', name: 'NAS במשרד', kind: 'sftp', enabled: true, config: { host: 'nas.example.net', port: 22, username: 'arx', remote_dir: '/backups', host_key: 'SHA256:' + 'Q'.repeat(43) },
        secrets: { key: true }, retention: { keep_last: 3, keep_daily: 7, keep_weekly: 4, keep_monthly: 6 }, revision: 1, updated_at: '2026-10-19T10:00:00Z',
        last: { push: run('push', false, 'host_key_mismatch'), test: null, drill: null } },
    ],
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body = req.postData() ? req.postDataJSON() : null;
    if (method !== 'GET') st.calls.push({ method, path: p, body });
    if (p === 'me') return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings' && method === 'PATCH') st.settings = { ...st.settings, ...(body as Record<string, unknown>) };
    if (p === 'settings') return json(route, { settings: st.settings, can_edit: true });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-10-20T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'backups') return json(route, { backups: [LOCAL_BACKUP], policy: { 'auto-daily': 7, 'auto-pre-upgrade': 5 }, bytes: 0, schema_version: 132 });
    if (p === 'backups/offbox') {
      return json(route, { targets: st.targets, running: false, transports: { s3: true, sftp: true, local: true },
        key: { active: '3f2a9c1d7b6e5a40', keys: [{ id: '3f2a9c1d7b6e5a40', created_at: '2026-10-01T00:00:00Z', source: 'generated', exported: st.exported, exported_at: null, active: true }] } });
    }
    if (p === 'backups/drill' && method === 'GET') {
      return json(route, { running: false, history: [], schedule: { monthly: true, next_due_at: '2026-11-19T03:00:00Z', due_now: false },
        last: { result: 'PASS', finished_at: '2026-10-20T03:10:00Z', checks: [] }, last_offbox: { result: 'PASS', finished_at: '2026-10-20T03:12:00Z', checks: [] } });
    }
    if (p === 'backups/drill' && method === 'POST') return json(route, { started: true }, 202);
    if (p === 'backups/offbox/targets' && method === 'POST') {
      const b = body as { name: string; kind: string; config: Record<string, unknown>; secrets: Record<string, string> };
      const t = { id: 't3', name: b.name, kind: b.kind, enabled: true, config: b.config, secrets: Object.fromEntries(Object.keys(b.secrets).map((k) => [k, true])),
        retention: { keep_last: 3, keep_daily: 7, keep_weekly: 4, keep_monthly: 6 }, revision: 1, updated_at: '2026-10-20T10:00:00Z', last: { push: null, test: null, drill: null } };
      st.targets = [...st.targets, t];
      return json(route, t, 201);
    }
    if (p === 'backups/offbox/targets/t1/copies') return json(route, { target_id: 't1', copies: [{ name: 'manual-20261020-030000.zip.swxb', bytes: 1048576, stamp: '2026-10-20T03:00:00Z' }] });
    if (p === 'backups/offbox/restore/prepare') {
      return json(route, { id: 'a1b2c3d4e5f60718', object: 'manual-20261020-030000.zip.swxb', key_id: '3f2a9c1d7b6e5a40', sealed_sha256: 'a'.repeat(64), sealed_bytes: 1048576,
        plain_sha256: 'b'.repeat(64), plain_bytes: 2097152, app_version: '2.27.2', schema_version: 132, kind: 'manual', archive_created_at: '2026-10-20T03:00:00Z',
        tables: { sites: 1, floors: 2 }, files: 3, sensitive: 'omitted', warnings: [], timings_ms: { total: 900 }, expires_in_s: 1800 });
    }
    if (p.startsWith('backups/offbox/restore/') && method === 'DELETE') return route.fulfill({ status: 204 });
    const weak = (b: unknown) => (b as { safety_backup_password?: string })?.safety_backup_password === 'short';
    const weakErr = () => json(route, { code: 'safety_password_weak', user_message: 'weak', retryable: false, correlation_id: 'mock', details: { can_skip: false, min_chars: 12 } }, 422);
    if (p === 'backups/offbox/restore' && method === 'POST') {
      if (weak(body)) return weakErr();
      return json(route, { object: 'manual-20261020-030000.zip.swxb', safety_archive: SAFETY, scope: (body as { scope: string }).scope, tables: { sites: 1, floors: 2 }, files: 3 });
    }
    if (p === `backups/${LOCAL_BACKUP.name}/restore` && method === 'POST') {
      if (weak(body)) return weakErr();
      const on = st.settings['backup.safety_before_local_restore'] !== 'off';
      return json(route, { name: LOCAL_BACKUP.name, mode: 'replace', scope: 'project', tables: { sites: 1, floors: 2 }, files: 3, app_version: '2.27.2', created_at: LOCAL_BACKUP.created_at,
        safety_archive: on ? SAFETY : null });
    }
    if (p === 'backups/offbox/targets/t2/test') return json(route, { ok: false, error: 'auth_failed', steps: [] });
    if (p === 'backups/offbox/targets/t1/test') return json(route, { ok: true, error: null, steps: ['write', 'read', 'delete', 'list'] });
    if (p === 'backups/offbox/key/export') {
      if ((body as { confirm: string }).confirm !== 'EXPORT') return apiErr(route, 'confirm_required');
      if (st.exported) return apiErr(route, 'key_already_exported', 409);
      st.exported = true;
      return json(route, { key_id: '3f2a9c1d7b6e5a40', key: 'SWXB-KEY-1:3f2a9c1d7b6e5a40:' + 'A'.repeat(43) + '=' });
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return st;
}

async function open(page: Page) {
  await page.goto('/?design=a#/system/diagnostics?tab=backup');
  const card = page.locator('sw-offbox-backup');
  await expect(card.locator('[data-offbox-target="t1"]')).toBeVisible();
  return card;
}

test('the targets, the key and the drill rows', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  const card = await open(page);
  await expect(card.locator('[data-offbox-target="t1"] [data-run="push"]')).toContainText('נבדק');
  await expect(card.locator('[data-offbox-target="t2"] [data-run="push"]')).toContainText('מפתח השרת לא תואם');
  await expect(card.locator('[data-offbox-key] code')).toHaveText('3f2a9c1d7b6e5a40');
  await expect(card.locator('[data-offbox-drill] [data-drill-run]')).toBeVisible();
  await expect(card.locator('[data-offbox-drill] [data-drill-run-target]')).toHaveCount(2);
  await shot(page, 'offbox-overview');
  expect(errors).toEqual([]);
});

test('adding an S3 target sends the credentials once and never shows them', async ({ page }) => {
  const mock = await setup(page);
  const card = await open(page);
  await card.locator('[data-offbox-add="s3"]').click();
  const form = card.locator('[data-offbox-form="s3"]');
  await form.locator('[data-f="name"]').fill('Backblaze');
  await form.locator('[data-f="endpoint"]').fill('https://s3.eu-central-003.example.net');
  await form.locator('[data-f="bucket"]').fill('arx-copies');
  await form.locator('[data-secret="access_key"]').fill('AKID-INVENTED');
  await form.locator('[data-secret="secret_key"]').fill('SECRET-INVENTED-123');
  await shot(page, 'offbox-add-s3');
  await form.locator('[data-offbox-save]').click();
  await expect(card.locator('[data-offbox-target="t3"]')).toBeVisible();
  const post = mock.calls.find((c) => c.method === 'POST' && c.path === 'backups/offbox/targets');
  expect(post?.body).toMatchObject({ name: 'Backblaze', kind: 's3', secrets: { access_key: 'AKID-INVENTED', secret_key: 'SECRET-INVENTED-123' },
    config: { endpoint: 'https://s3.eu-central-003.example.net', bucket: 'arx-copies', region: 'auto', path_style: true } });
  await card.locator('[data-offbox-target="t3"] [data-offbox-edit]').click();
  await expect(card.locator('[data-secret="secret_key"]')).toHaveValue('');
  await expect(card.locator('[data-secret="secret_key"]')).toHaveAttribute('placeholder', /שמור/);
  expect(await page.content()).not.toContain('SECRET-INVENTED-123');
});

test('the key export needs EXPORT, shows the key once, then cannot run again', async ({ page }) => {
  const mock = await setup(page);
  const card = await open(page);
  await card.locator('[data-offbox-export]').click();
  const dlg = card.locator('[data-offbox-key-dialog="export"]');
  await expect(dlg.locator('[data-offbox-key-go]')).toHaveAttribute('disabled', ''); // sw-button: a custom element, not a native control
  await dlg.locator('[data-offbox-confirm]').fill('EXPORT');
  await expect(dlg.locator('[data-offbox-key-go]')).toHaveAttribute('disabled', ''); // typed word alone is not enough
  await dlg.locator('[data-offbox-ack]').check();
  await dlg.locator('[data-offbox-key-go]').click();
  await expect(dlg.locator('[data-offbox-key-text]')).toHaveValue(/^SWXB-KEY-1:3f2a9c1d7b6e5a40:/);
  await shot(page, 'offbox-key-export');
  await dlg.getByRole('button', { name: 'ביטול' }).click();
  await expect(card.locator('[data-offbox-export]')).toHaveAttribute('disabled', '');
  expect(mock.calls.filter((c) => c.path === 'backups/offbox/key/export')).toHaveLength(1);
});

test('connection test answers in words; the drill starts', async ({ page }) => {
  const mock = await setup(page);
  const card = await open(page);
  await card.locator('[data-offbox-target="t2"] [data-offbox-test]').click();
  await expect(card.locator('[data-offbox-msg]')).toContainText('פרטי הכניסה נדחו');
  await card.locator('[data-offbox-target="t1"] [data-offbox-test]').click();
  await expect(card.locator('[data-offbox-msg]')).toContainText('החיבור תקין');
  await card.locator('[data-drill-run-target="t1"]').click();
  await expect.poll(() => mock.calls.some((c) => c.path === 'backups/drill' && (c.body as { target_id?: string })?.target_id === 't1')).toBe(true);
});

// ---------------------------------------------------------------- OFFBOX-RESTORE-2300, owner decisions 2026-10-30

const SAFETY_PW = 'an invented safety password';

test('restore from a copy: the scope starts from the setting, the safety password is sent once and the dialog does not scroll', async ({ page }) => {
  const mock = await setup(page);
  mock.settings['backup.offbox_restore_scope'] = 'project';
  const card = await open(page);
  await expect(card.locator('[data-offbox-scope-toggle]')).not.toHaveAttribute('checked', '');
  await card.locator('[data-offbox-target="t1"] [data-offbox-restore-open]').click();
  const dlg = card.locator('[data-offbox-restore-dialog]');
  await dlg.locator('[data-offbox-prepare]').click();
  await expect(dlg.locator('[data-offbox-restore-access]')).not.toBeChecked();
  const safety = dlg.locator('[data-offbox-restore-safety]');
  await expect(safety).toHaveAttribute('type', 'password');
  await expect(safety).toHaveAttribute('placeholder', /12/);
  await safety.fill('short');
  await dlg.locator('[data-offbox-restore-confirm]').fill('RESTORE');
  await dlg.locator('[data-offbox-restore-go]').click();
  await expect(dlg.locator('[data-offbox-restore-err]')).toContainText('12');
  await expect(safety).toHaveValue('');
  await safety.fill(SAFETY_PW);
  const overflow = await dlg.evaluate((el) => { const b = el.shadowRoot?.querySelector('.body') as HTMLElement | null; return b ? b.scrollHeight - b.clientHeight : -1; });
  expect(overflow, 'the restore dialog body does not scroll').toBeLessThanOrEqual(1);
  await shot(page, 'offbox-restore-safety');
  await dlg.locator('[data-offbox-restore-go]').click();
  await expect(card.locator('[data-offbox-msg]')).toContainText(SAFETY.name);
  const sent = mock.calls.filter((c) => c.path === 'backups/offbox/restore');
  expect(sent.at(-1)?.body).toMatchObject({ scope: 'project', safety_backup_password: SAFETY_PW, confirm: 'RESTORE' });
  expect(await page.content()).not.toContain(SAFETY_PW);
});

test('the scope default is a switch saved at once', async ({ page }) => {
  const mock = await setup(page);
  const card = await open(page);
  const toggle = card.locator('[data-offbox-scope-toggle]');
  await expect(toggle).toHaveAttribute('checked', '');
  await toggle.click();
  await expect.poll(() => mock.calls.find((c) => c.method === 'PATCH' && c.path === 'settings')?.body).toEqual({ 'backup.offbox_restore_scope': 'project' });
});

test('local restore: a safety backup first, with its own optional password; the switch turns it off', async ({ page }) => {
  const mock = await setup(page);
  await open(page);
  await page.locator('[data-backup-restore]').first().click();
  const pw = page.locator('[data-restore-safety]');
  await expect(pw).toBeVisible();
  await pw.fill(SAFETY_PW);
  const local = page.locator('sw-dialog').filter({ has: pw });
  const overflow = await local.evaluate((el) => { const b = el.shadowRoot?.querySelector('.body') as HTMLElement | null; return b ? b.scrollHeight - b.clientHeight : -1; });
  expect(overflow, 'the local restore dialog body does not scroll').toBeLessThanOrEqual(1);
  await page.locator('[data-restore-confirm]').fill('RESTORE');
  await page.locator('[data-restore-go]').click();
  await expect.poll(() => mock.calls.find((c) => c.path === `backups/${LOCAL_BACKUP.name}/restore`)?.body).toMatchObject({ safety_backup_password: SAFETY_PW });
  await expect(page.locator('body')).not.toContainText(SAFETY_PW);
  await page.locator('[data-backup-local-safety]').click();
  await expect.poll(() => mock.calls.find((c) => c.method === 'PATCH' && c.path === 'settings')?.body).toEqual({ 'backup.safety_before_local_restore': 'off' });
  await page.locator('[data-backup-restore]').first().click();
  await expect(page.locator('[data-restore-safety-off]')).toBeVisible();
  await expect(page.locator('[data-restore-safety]')).toHaveCount(0);
});
