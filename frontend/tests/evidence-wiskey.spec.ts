import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Evidence for T054 (CR-005 phase 1a, WisKey entry center) against a running developer backend. The developer backend
// has no Home Assistant and so no WisKey behind it: the screen must say so plainly and show no station data. The
// WisKey nav entry is gated on access.read at installation scope - hidden for a role without it and for a floor- or
// site-scoped binding, shown for a plain installation-wide viewer and the admin.
//
// 0.1.103: owner override 2026-09-27 moved WisKey from a "sites"/"explore" sub-tab to its own top-level nav entry, a
// peer of Map/Investigate/System (design A) and a 7th flat entry (design B) - see docs/architecture/DECISIONS.md
// (ADR-009 note) and docs/changes/CR-005-ACCESS-CONTROL-INTEGRATION.md. New href: #/wiskey/overview.
// Runs only with SW_LIVE=1.

const HREF = '#/wiskey/overview';
const RAIL = 'sw-app nav.rail';

test.describe('WisKey entry center (T054, top-level nav since 0.1.103)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string, design: 'a' | 'b' = 'a') {
    await page.goto(`/?design=${design}#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1200);
  }

  /** Bind a developer-identity user to a role at installation scope (same convention as the T057 / T091 evidence). */
  async function bindUser(request: APIRequestContext, username: string, roleId: string): Promise<{ userId: string; bindingId: string }> {
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
    const existing = ((await (await request.get('/api/v1/access/bindings')).json()).bindings ?? []) as { id: string; role_id: string; subject_id: string }[];
    const already = existing.find((b) => b.role_id === roleId && b.subject_id === me.user.id);
    if (already) return { userId: me.user.id, bindingId: already.id };
    const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, scope_type: 'installation', scope_id: '*' } });
    expect(r.status()).toBeLessThan(300);
    return { userId: me.user.id, bindingId: ((await r.json()) as { id: string }).id };
  }

  test('the admin opens WisKey as a top-level rail entry (design A) and sees the honest not-configured state', async ({ page, request }, testInfo) => {
    const feed = await (await request.get('/api/v1/intercom/overview')).json();
    expect(feed.state).toBe('ha_not_configured');
    expect(feed.configured).toBe(false);
    expect(feed.overview).toBeNull();

    await open(page, '/live', 'a');
    // top-level rail entry, a peer of live/map/investigate/system - not nested under מפה's sub-tabs. toHaveCount
    // (not toBeVisible/click) so this holds on every viewport: nav.rail is CSS-hidden on mobile in favor of
    // nav.bottom, but the entry and its href must exist there all the same.
    const link = page.locator(`${RAIL} a[href="${HREF}"]`);
    await expect(link).toHaveCount(1, { timeout: 30000 });
    await expect(link).toContainText('WisKey');
    await open(page, '/wiskey/overview', 'a');
    expect(await page.evaluate(() => location.hash)).toBe(HREF);

    // it is its own area now: the map's own sub-tabs (sites/floors/entities) are not shown for it
    await expect(page.locator('sw-tabs a[href="#/explore/sites"]')).toHaveCount(0);

    const screen = page.locator('wiskey-overview');
    const panel = screen.locator('sw-state-panel[data-wiskey-state="ha_not_configured"]');
    await expect(panel).toBeVisible({ timeout: 30000 });
    await expect(panel).toHaveAttribute('heading', 'WisKey אינו מחובר בסביבה הזו');
    await expect(panel).toHaveAttribute('hint', /אין כאן גישה ל־Home Assistant/);
    await expect(screen.locator('[data-wiskey-feed="ha_not_configured"]')).toBeVisible();
    // nothing invented: no stations, no counters, no activity
    await expect(screen.locator('[data-wiskey-door]')).toHaveCount(0);
    await expect(screen.locator('[data-wiskey-stats]')).toHaveCount(0);
    await expect(screen.locator('[data-wiskey-activity]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('wiskey-not-configured.png') });
  });

  test('WisKey is also its own top-level rail entry in design B (the six-flat-entries board), not a sites sub-tab', async ({ page }) => {
    await open(page, '/live', 'b');
    const link = page.locator(`${RAIL} a[href="${HREF}"]`);
    await expect(link).toHaveCount(1, { timeout: 30000 });
    await expect(link).toContainText('WisKey');
    // the sites entry keeps its own tabs, none of them WisKey any more
    await open(page, '/wiskey/overview', 'b');
    expect(await page.evaluate(() => location.hash)).toBe(HREF);
    await expect(page.locator('sw-tabs a[href="#/explore/sites"]')).toHaveCount(0);
    await expect(page.locator('wiskey-overview')).toHaveCount(1);
  });

  test('the WisKey rail entry is gated on access.read, in both designs', async ({ page, browser, request }) => {
    const bindings: string[] = [];
    let roleId: string | undefined;
    try {
      // a role that can read the map and live video but not access control
      const role = await request.post('/api/v1/access/roles', { data: { name: 'T054 no access control', description: 'evidence', permissions: ['map.read', 'video.live'] } });
      expect(role.status()).toBeLessThan(300);
      roleId = ((await role.json()) as { id: string }).id;
      bindings.push((await bindUser(request, 'wiskeyno054', roleId)).bindingId);
      const without = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': 'wiskeyno054' } });
      const p1 = await without.newPage();
      await open(p1, '/live', 'a');
      await expect(p1.locator(`${RAIL} a[href="#/explore/sites"]`)).toHaveCount(1, { timeout: 30000 });
      await expect(p1.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(0);
      // typing the address does not help: the screen refuses, and so does the API
      await open(p1, '/wiskey/overview', 'a');
      await expect(p1.locator('wiskey-overview sw-state-panel[data-wiskey-state="no_permission"]')).toBeVisible({ timeout: 30000 });
      expect((await p1.request.get('/api/v1/intercom/overview')).status()).toBe(403);
      // same story in design B
      await open(p1, '/live', 'b');
      await expect(p1.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(0);
      await without.close();

      // a plain viewer holds access.read
      bindings.push((await bindUser(request, 'wiskeyviewer054', 'viewer')).bindingId);
      const viewer = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': 'wiskeyviewer054' } });
      const p2 = await viewer.newPage();
      await open(p2, '/live', 'a');
      await expect(p2.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
      await expect(p2.locator(`${RAIL} a[href="${HREF}"]`)).toContainText('WisKey');
      await open(p2, '/wiskey/overview', 'a');
      await expect(p2.locator('wiskey-overview sw-state-panel[data-wiskey-state="ha_not_configured"]')).toBeVisible({ timeout: 30000 });
      await viewer.close();

      // and the admin (dev-mode default identity)
      await open(page, '/live', 'a');
      await expect(page.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      if (roleId) await request.delete(`/api/v1/access/roles/${roleId}`).catch(() => {});
    }
  });

  test('a floor-scoped viewer and a site-scoped site_admin do not see the WisKey rail entry', async ({ browser, request }) => {
    // access.read counts only at installation scope (WisKey stations are not mapped to sites or floors); the entry must
    // not appear for someone who holds it only below that, or they would land on "no permission"
    const bindings: string[] = [];
    let siteId: string | undefined;
    try {
      const site = await request.post('/api/v1/sites', { data: { name: 'T054 scoped site' } });
      expect(site.status()).toBe(201);
      siteId = ((await site.json()) as { id: string }).id;
      const building = await request.post(`/api/v1/sites/${siteId}/buildings`, { data: { name: 'T054 building' } });
      expect(building.status()).toBe(201);
      const floor = await request.post(`/api/v1/buildings/${((await building.json()) as { id: string }).id}/floors`, { data: { name: 'T054 floor' } });
      expect(floor.status()).toBe(201);
      const floorId = ((await floor.json()) as { id: string }).id;

      for (const [username, roleId, scopeType, scopeId] of [
        ['wiskeyfloor054', 'viewer', 'floor', floorId],
        ['wiskeysite054', 'site_admin', 'site', siteId],
      ] as const) {
        const headers = { 'X-SW-Dev-User': username };
        const me0 = await (await request.get('/api/v1/me', { headers })).json();
        const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me0.user.id, role_id: roleId, scope_type: scopeType, scope_id: scopeId } });
        expect(r.status()).toBeLessThan(300);
        bindings.push(((await r.json()) as { id: string }).id);
        const me = await (await request.get('/api/v1/me', { headers })).json();
        expect(me.permissions_any, `${username} holds access.read below installation scope`).toContain('access.read');
        expect(me.permissions_installation).not.toContain('access.read');

        const ctx = await browser.newContext({ extraHTTPHeaders: headers });
        const p = await ctx.newPage();
        await open(p, '/live', 'a');
        await expect(p.locator(`${RAIL} a[href="#/explore/sites"]`), `${username} still sees the map area`).toHaveCount(1, { timeout: 30000 });
        await expect(p.locator(`${RAIL} a[href="${HREF}"]`), `${username} does not see the WisKey rail entry`).toHaveCount(0);
        expect((await p.request.get('/api/v1/intercom/overview')).status()).toBe(403);
        await ctx.close();
      }
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      if (siteId) await request.delete(`/api/v1/sites/${siteId}`).catch(() => {});
    }
  });

  test('hiding the map has no effect on WisKey any more, in either design (it is no longer a map/sites sub-tab)', async ({ page, request }) => {
    // re-review 1 (T054) taught that הסתרת המפה must not take the WisKey tab down with the map; since 0.1.103 WisKey
    // is not part of the map/sites area at all, so this is now a non-interaction, confirmed explicitly rather than
    // left as stale logic.
    const before = (await (await request.get('/api/v1/settings')).json()).settings as Record<string, unknown>;
    try {
      expect((await request.patch('/api/v1/settings', { data: { 'ui.hide_map': 'true' } })).status()).toBe(200);

      await open(page, '/wiskey/overview', 'a');
      await expect(page.locator('wiskey-overview sw-state-panel[data-wiskey-state="ha_not_configured"]')).toBeVisible({ timeout: 30000 });
      const railA = page.locator(RAIL);
      await expect(railA.locator(`a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
      // the map area itself is the one that disappears
      await expect(railA.locator('a[href="#/explore/sites"]')).toHaveCount(0);

      await open(page, '/wiskey/overview', 'b');
      const railB = page.locator(RAIL);
      await expect(railB.locator(`a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
      await expect(railB.locator('a[href="#/explore/sites"]')).toHaveCount(0);
      await expect(page.locator('wiskey-overview sw-state-panel[data-wiskey-state="ha_not_configured"]')).toBeVisible({ timeout: 30000 });
    } finally {
      await request.patch('/api/v1/settings', { data: { 'ui.hide_map': String(before['ui.hide_map'] ?? 'false') } });
    }
  });
});
