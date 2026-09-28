import { test, expect, type APIRequestContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for groups and delegated assignment (T082, R163/R164) against a running developer backend (a throwaway
// instance is enough - the spec seeds its own site / building / floor and dev users): the system administrator creates
// a group in the "קבוצות" card, binds a role to it and adds a member - each change behind the impact dialog that names
// every affected user - and the member gets exactly that access; a site administrator sees only the roles on the
// delegation allow-list (never system_admin / site_admin) and only the scopes of their own site. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T082-groups-live');
const MEMBER = { 'X-SW-Dev-User': 't082member' };
const SARA = { 'X-SW-Dev-User': 't082sara' };

interface Seed {
  site: string;
  floor: string;
  otherFloor: string;
}

async function seed(request: APIRequestContext): Promise<Seed> {
  const tree = await (await request.get('/api/v1/sites?tree=true')).json();
  const find = (name: string) => (tree.sites as { id: string; name: string; buildings: { id: string; floors: { id: string }[] }[] }[]).find((s) => s.name === name);
  const ensure = async (name: string) => {
    const have = find(name);
    if (have && have.buildings[0]?.floors[0]) return { site: have.id, floor: have.buildings[0].floors[0].id };
    const site = (await (await request.post('/api/v1/sites', { data: { name } })).json()).id as string;
    const bld = (await (await request.post(`/api/v1/sites/${site}/buildings`, { data: { name: 'מבנה T082' } })).json()).id as string;
    const floor = (await (await request.post(`/api/v1/buildings/${bld}/floors`, { data: { name: 'קומה T082', level: 1 } })).json()).id as string;
    return { site, floor };
  };
  const a = await ensure('אתר T082');
  const b = await ensure('אתר T082 ב');
  for (const h of [MEMBER, SARA]) await request.get('/api/v1/me', { headers: h });
  return { site: a.site, floor: a.floor, otherFloor: b.floor };
}

async function cleanup(request: APIRequestContext, groupName: string) {
  const groups = (await (await request.get('/api/v1/access/groups')).json()).groups as { id: string; name: string; revision: number; bindings: { id: string }[] }[];
  for (const g of groups.filter((x) => x.name === groupName)) {
    let rev = g.revision;
    for (const b of g.bindings) {
      const r = await request.delete(`/api/v1/access/groups/${g.id}/bindings/${b.id}?revision=${rev}`);
      rev = (await r.json()).group?.revision ?? rev;
    }
    const m = await request.put(`/api/v1/access/groups/${g.id}/members`, { data: { user_ids: [], revision: rev } });
    rev = (await m.json()).revision ?? rev;
    await request.delete(`/api/v1/access/groups/${g.id}?revision=${rev}`);
  }
  const bindings = (await (await request.get('/api/v1/access/bindings')).json()).bindings as { id: string; subject_id: string }[];
  for (const b of bindings.filter((x) => x.subject_id === 'dev-t082sara' || x.subject_id === 'dev-t082member')) await request.delete(`/api/v1/access/bindings/${b.id}`);
}

test.describe('groups and delegation (T082)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('admin creates a group, binds a role, adds a member behind the impact dialog; the member gets access', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const name = `קבוצת ראיות ${new Date().toISOString().slice(11, 19)}`;
    const s = await seed(request);
    await cleanup(request, name);
    expect((await request.get(`/api/v1/floors/${s.floor}/map`, { headers: MEMBER })).status()).toBe(403);

    await page.goto('/?design=a#/system/access');
    await page.waitForSelector('sw-app');
    const screen = page.locator('system-access');
    await screen.locator('sw-tabs').getByText('קבוצות').click();
    const card = screen.locator('[data-groups-card]');
    await expect(card.locator('[data-group-new]')).toBeVisible({ timeout: 20000 });
    await card.locator('[data-group-new]').fill(name);
    await card.locator('[data-group-create]').click();
    const drawer = screen.locator('[data-group-drawer]');
    await expect(drawer).toBeVisible({ timeout: 15000 });

    // bind viewer on the seeded floor: the impact dialog shows before anything is saved
    await drawer.locator('[data-group-bind]').click();
    await drawer.locator('[data-wizard-role]').selectOption('viewer');
    await drawer.locator('[data-wizard-scope]').selectOption(`floor:${s.floor}`);
    await drawer.locator('[data-wizard-save]').click();
    const dlg = screen.locator('[data-group-impact]');
    await expect(dlg.locator('.impact')).toBeVisible({ timeout: 15000 }); // the host box is empty (fixed backdrop)
    await expect(dlg).toContainText('0 משתמשים מושפעים');
    await dlg.locator('[data-group-impact-confirm]').click();
    await expect(dlg).toHaveCount(0, { timeout: 15000 });
    await expect(drawer.locator('[data-binding]')).toHaveCount(1, { timeout: 15000 });

    // add the member: the dialog names them and what they gain
    await drawer.locator('[data-member="dev-t082member"]').check();
    await drawer.locator('[data-group-save-members]').click();
    await expect(dlg.locator('.impact')).toBeVisible({ timeout: 15000 }); // the host box is empty (fixed backdrop)
    await expect(dlg.locator('[data-impact-user="dev-t082member"]')).toContainText('יתווספו', { timeout: 10000 });
    await page.screenshot({ path: path.join(OUT, `group-impact-${testInfo.project.name}.png`) });
    await dlg.locator('[data-group-impact-confirm]').click();
    await expect(dlg).toHaveCount(0, { timeout: 15000 });

    // the member now reads the floor, and nothing else widened
    await expect.poll(async () => (await request.get(`/api/v1/floors/${s.floor}/map`, { headers: MEMBER })).status(), { timeout: 15000 }).toBe(200);
    expect((await request.get(`/api/v1/floors/${s.otherFloor}/map`, { headers: MEMBER })).status()).toBe(403);
    // a group in use cannot be deleted from the card
    await expect(drawer.locator('[data-group-delete] button')).toBeDisabled();
    await expect(drawer.locator('[data-group-in-use]')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `group-drawer-${testInfo.project.name}.png`) });

    await cleanup(request, name);
    expect((await request.get(`/api/v1/floors/${s.floor}/map`, { headers: MEMBER })).status()).toBe(403);
  });

  test('a site admin sees only allow-listed roles and their own scopes; never system_admin', async ({ page, request }, testInfo) => {
    test.setTimeout(120000);
    const s = await seed(request);
    await cleanup(request, '__none__');
    const b = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: 'dev-t082sara', role_id: 'site_admin', scope_type: 'site', scope_id: s.site } });
    expect(b.status()).toBe(201);
    try {
      await page.setExtraHTTPHeaders(SARA);
      await page.goto('/?design=a#/system/access');
      await page.waitForSelector('sw-app');
      const screen = page.locator('system-access');
      await expect(screen.locator('sw-table').getByText('t082member').first()).toBeVisible({ timeout: 20000 });
      await screen.locator('sw-table').getByText('t082member').first().click();
      await screen.locator('[data-assign]').click();
      const roles = await screen.locator('[data-wizard-role] option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
      expect(roles).toContain('viewer');
      expect(roles).toContain('operator');
      expect(roles).not.toContain('system_admin');
      expect(roles).not.toContain('site_admin');
      const scopes = await screen.locator('[data-wizard-scope] option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
      expect(scopes).toContain(`site:${s.site}`);
      expect(scopes).toContain(`floor:${s.floor}`);
      expect(scopes).not.toContain('installation:*');
      expect(scopes).not.toContain(`floor:${s.otherFloor}`);
      await expect(screen.locator('[data-delegated-hint]')).toBeVisible();
      await page.screenshot({ path: path.join(OUT, `site-admin-wizard-${testInfo.project.name}.png`) });
      // the server refuses a system role even if the UI were bypassed
      const forged = await request.post('/api/v1/access/bindings', { headers: SARA, data: { subject_kind: 'user', subject_id: 'dev-t082member', role_id: 'system_admin', scope_type: 'installation', scope_id: '*' } });
      expect(forged.status()).toBe(403);
    } finally {
      await cleanup(request, '__none__');
    }
  });
});
