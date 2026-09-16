import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the suggested path (T064) against the running developer backend: for a real event of a placed camera
// the API ranks the neighbouring cameras (same room / adjacent room / within reach) with the window and their
// activity, labels everything hypothetical, and the event page shows the card. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T064-route-live');

interface Route { spatial: boolean; hypothetical: boolean; suggestions: { name: string; relation: string; activity_events: number }[]; notes: string[]; policy: string; subject: { zone: string | null } | null }

test.describe('suggested path (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('ranked neighbours for a real event and the event page card', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const events = (await (await request.get('/api/v1/events?limit=150')).json()).events as { id: string; camera_id: string | null }[];
    const findPicked = async () => {
      for (const e of events.filter((x) => x.camera_id).slice(0, 80)) {
        const r = await request.get(`/api/v1/events/${e.id}/route`);
        expect(r.status()).toBe(200);
        const route = (await r.json()) as Route;
        if (route.spatial && route.suggestions.length) return { id: e.id, route };
      }
      return null;
    };
    let picked = await findPicked();
    let tempAnchor: string | null = null;
    if (!picked) {
      // the lab floors carry one camera each: place a second (unplaced) camera beside an existing one for the evidence, then remove it
      const tree = await (await request.get('/api/v1/sites?tree=true')).json();
      const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors)).filter((f: { has_plan: boolean }) => f.has_plan);
      const cams = (await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean }[];
      for (const f of floors) {
        const m = await (await request.get(`/api/v1/floors/${f.id}/map`)).json();
        const placed = m.anchors.filter((a: { resource_type: string }) => a.resource_type === 'camera') as { resource_id: string; position: { x: number; y: number } }[];
        const eventCam = placed.find((a) => events.some((e) => e.camera_id === a.resource_id));
        const spare = cams.find((c) => c.enabled && !placed.some((a) => a.resource_id === c.id));
        if (!eventCam || !spare) continue;
        const r = await request.post(`/api/v1/floors/${f.id}/anchors`, { data: { resource_type: 'camera', resource_id: spare.id, x: Math.min(0.95, eventCam.position.x + 0.08), y: eventCam.position.y } });
        expect(r.status()).toBe(201);
        tempAnchor = (await r.json()).id;
        testInfo.annotations.push({ type: 'setup', description: 'placed a spare camera beside the event camera for the evidence; removed at the end' });
        break;
      }
      picked = await findPicked();
    }
    expect(picked, 'an event of a placed camera with neighbours on the plan').toBeTruthy();
    const r = picked!.route;
    expect(r.hypothetical).toBe(true);
    expect(r.policy).toContain('אותו אדם');
    const ranks = r.suggestions.map((s) => ({ same_zone: 0, adjacent_zone: 1, nearby: 2 }[s.relation] ?? 9));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    testInfo.annotations.push({ type: 'route', description: `zone=${r.subject?.zone ?? '-'} suggestions=${r.suggestions.map((s) => `${s.name}:${s.relation}:${s.activity_events}`).join(', ')}` });

    await page.goto(`/?design=a#/investigate/events/${picked!.id}`);
    await page.waitForSelector('sw-app');
    const card = page.locator('investigate-event-detail [data-route]');
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card.locator('[data-route-item]')).toHaveCount(r.suggestions.length);
    await expect(card).toContainText('השערה');
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `event-route-${testInfo.project.name}.png`), fullPage: true });
    if (tempAnchor) expect((await request.delete(`/api/v1/map-anchors/${tempAnchor}`)).status()).toBe(204);
  });
});
