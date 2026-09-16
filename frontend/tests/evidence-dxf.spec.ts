import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for T065 against the running developer backend: a DXF is uploaded through the import wizard, its units,
// layers and unsupported entities are shown (partial conversion stated), a layer choice re-renders the preview, and a
// version made from it carries the scale the units imply. Local dev data only. SW_LIVE=1 only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T065-dxf-live');

const DXF = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES',
  ...['0', 'LINE', '8', 'WALLS', '10', '0', '20', '0', '30', '0', '11', '12000', '21', '0', '31', '0'],
  ...['0', 'LINE', '8', 'WALLS', '10', '12000', '20', '0', '30', '0', '11', '12000', '21', '8000', '31', '0'],
  ...['0', 'LINE', '8', 'WALLS', '10', '12000', '20', '8000', '30', '0', '11', '0', '21', '8000', '31', '0'],
  ...['0', 'LINE', '8', 'WALLS', '10', '0', '20', '8000', '30', '0', '11', '0', '21', '0', '31', '0'],
  ...['0', 'LINE', '8', 'WALLS', '10', '6000', '20', '0', '30', '0', '11', '6000', '21', '8000', '31', '0'],
  ...['0', 'CIRCLE', '8', 'DOORS', '10', '3000', '20', '4000', '30', '0', '40', '600'],
  ...['0', 'ARC', '8', 'DOORS', '10', '6000', '20', '4000', '30', '0', '40', '900', '50', '0', '51', '90'],
  ...['0', 'TEXT', '8', 'LABELS', '10', '100', '20', '100', '30', '0', '40', '250', '1', 'Lobby'],
  '0', 'ENDSEC', '0', 'EOF', ''].join('\r\n');

test.describe('DXF import (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('upload, inspect, choose layers, re-render, version with scale', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    // a scratch floor of its own so no real plan is touched
    const site = await (await request.post('/api/v1/sites', { data: { name: `DXF ${new Date().toISOString().slice(11, 19)}` } })).json();
    const bld = await (await request.post(`/api/v1/sites/${site.id}/buildings`, { data: { name: 'מבנה DXF' } })).json();
    const floor = await (await request.post(`/api/v1/buildings/${bld.id}/floors`, { data: { name: 'קומת DXF', level: 1 } })).json();
    await page.goto(`/#/explore/floors/${floor.id}/import`);
    await page.waitForSelector('sw-app');
    const screen = page.locator('explore-plan-import');
    // let the wizard finish loading the tree before the upload (the route re-renders once the catalogue arrives)
    await expect(screen.locator('h1')).toContainText('ייבוא תוכנית', { timeout: 30_000 });
    await page.waitForTimeout(1500);
    await screen.locator('input[type=file]').setInputFiles({ name: 'floor.dxf', mimeType: 'application/octet-stream', buffer: Buffer.from(DXF, 'utf-8') });
    const card = screen.locator('[data-dxf]');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('[data-dxf-units]')).toHaveText('mm');
    await expect(card.locator('[data-dxf-partial]')).toContainText('TEXT');
    await expect(card.locator('[data-dxf-layer="WALLS"]')).toBeChecked();
    await page.screenshot({ path: path.join(OUT, `dxf-inspect-${testInfo.project.name}.png`), fullPage: true });
    const assets = (await (await request.get(`/api/v1/floors/${floor.id}/plan-assets`)).json()).assets as { id: string; kind: string }[];
    expect(assets[0].kind).toBe('dxf');
    const before = await (await request.get(`/api/v1/plan-assets/${assets[0].id}/pages/1/preview.png`)).body();
    // draw the walls only
    await card.locator('[data-dxf-layer="DOORS"]').uncheck();
    await card.locator('[data-dxf-apply]').click();
    await expect(card.locator('[data-dxf-render]')).toContainText('1 שכבות', { timeout: 30_000 });
    const after = await (await request.get(`/api/v1/plan-assets/${assets[0].id}/pages/1/preview.png`)).body();
    expect(Buffer.compare(before, after)).not.toBe(0);
    const d = await (await request.get(`/api/v1/plan-assets/${assets[0].id}/dxf`)).json();
    expect(d.options.layers).toEqual(['WALLS']);
    expect(d.render.skipped).toEqual({ TEXT: 1 });
    await page.screenshot({ path: path.join(OUT, `dxf-layers-${testInfo.project.name}.png`), fullPage: true });
    // a version from the drawing carries the scale (12 m wide plus a 2 % margin each side over the version width)
    const v = await (await request.post(`/api/v1/floors/${floor.id}/plan-versions`, { data: { asset_id: assets[0].id } })).json();
    expect(v.scale_m_per_px).toBeGreaterThan(0);
    expect(Math.abs(v.scale_m_per_px * v.width_px - 12 * 1.04)).toBeLessThan(0.5);
    testInfo.annotations.push({ type: 'dxf', description: JSON.stringify({ info: { units: d.info.units, layers: d.info.layers.length, unsupported: d.info.unsupported }, render: d.render, version: { width_px: v.width_px, scale_m_per_px: v.scale_m_per_px } }) });
  });
});
