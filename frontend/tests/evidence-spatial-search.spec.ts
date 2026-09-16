import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for spatial metadata search (T062) against the running developer backend: facets say which fields have
// data and why others are empty; the event centre filters by floor / zone / source; a filter that cannot match is
// named as unsupported instead of a silent empty list. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T062-spatial-search-live');

interface Facets { days: number; types: { type: string; count: number }[]; sources: { source: string; count: number }[]; unavailable_types: { type: string; reason: string }[]; places: { buildings: { floors: { id: string; name: string; cameras: number; zones: { id: string; name: string; cameras: number }[] }[] }[] }[]; notes: string[] }

test.describe('spatial metadata search (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('facets, place and source filters, unsupported filter banner', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const f = (await (await request.get('/api/v1/events/facets')).json()) as Facets;
    expect(f.types.length).toBeGreaterThan(0);
    expect(f.unavailable_types.map((u) => u.type)).toContain('person');
    for (const u of f.unavailable_types) expect(u.reason.length).toBeGreaterThan(10);
    const floors = f.places.flatMap((s) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((x) => x.cameras > 0);
    expect(floor, 'a floor with placed cameras').toBeTruthy();
    testInfo.annotations.push({ type: 'facets', description: `types ${f.types.map((t) => `${t.type}:${t.count}`).join(',')} · sources ${f.sources.map((s) => `${s.source}:${s.count}`).join(',')} · unavailable ${f.unavailable_types.map((u) => u.type).join(',')}` });

    // API: the floor filter keeps only events of cameras placed there; an impossible type is unsupported, not "0 results"
    const byFloor = await (await request.get(`/api/v1/events?floor_id=${floor!.id}&limit=200`)).json();
    expect(byFloor.filters.applied).toEqual({ floor_id: floor!.id });
    expect(byFloor.filters.unsupported).toEqual([]);
    const map = await (await request.get(`/api/v1/floors/${floor!.id}/map`)).json();
    const placed = new Set(map.anchors.filter((a: { resource_type: string }) => a.resource_type === 'camera').map((a: { resource_id: string }) => a.resource_id));
    for (const e of byFloor.events) if (e.camera_id) expect(placed.has(e.camera_id)).toBe(true);
    const person = await (await request.get('/api/v1/events?type=person')).json();
    expect(person.events).toEqual([]);
    expect(person.filters.unsupported[0].field).toBe('type');
    const zoneWithCam = floor!.zones.find((z) => z.cameras > 0);
    if (zoneWithCam) {
      const byZone = await (await request.get(`/api/v1/events?zone_id=${zoneWithCam.id}&limit=200`)).json();
      expect(byZone.filters.unsupported).toEqual([]);
      testInfo.annotations.push({ type: 'zone', description: `${zoneWithCam.name}: ${byZone.events.length} events today` });
    }

    // UI: facets line, place filter, unsupported banner for the person type
    await page.goto('/?design=a#/investigate/events');
    await page.waitForSelector('sw-app');
    const screen = page.locator('investigate-events');
    await expect(screen.locator('[data-facets]')).toBeVisible({ timeout: 20000 });
    await expect(screen.locator('[data-facets]')).toContainText('לא זמין');
    await screen.locator('[data-filter-floor]').selectOption(floor!.id);
    await page.waitForTimeout(1500);
    await expect(screen.locator('[data-unsupported]')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `events-by-floor-${testInfo.project.name}.png`) });
    await screen.locator('select[aria-label="סוג"]').selectOption('person');
    await expect(screen.locator('[data-unsupported]')).toBeVisible({ timeout: 15000 });
    await expect(screen.locator('[data-unsupported]')).toContainText('אינו נתמך');
    await page.screenshot({ path: path.join(OUT, `unsupported-type-${testInfo.project.name}.png`) });
  });
});
