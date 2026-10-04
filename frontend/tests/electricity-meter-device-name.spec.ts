import { test, expect, type Page } from '@playwright/test';
import { installElectricityMock, PERMS, url } from './electricity-mocks';

// Meter picker and meters screens show the DEVICE a sensor belongs to (device name primary, the sensor's own name under it when it differs).
// Many sensors are called just "Energy"; the device is what tells them apart. Mocked backend, fake names only.

const PAGE = 'sw-app elec-meters-page';

const energy = (ref: string, device: string | null, area: string, state: string) => ({
  ref, name: 'Energy', device_id: device ? `dev_${ref}` : null, device_name: device, entity_name: 'Energy', area_id: null, area_name: area, unit: 'kWh', device_class: 'energy',
  state_class: 'total_increasing', state, verdict: 'ok', code: 'ok', message: null, already_meter_id: null,
});
const CANDIDATES = [
  energy('sensor.boiler_energy', 'דוד שמש', 'גג', '120.5'),
  energy('sensor.ac_energy', 'מזגן סלון', 'סלון', '88.1'),
  energy('sensor.lone_energy', null, 'מחסן', '3.2'),
  { ...energy('sensor.pump_energy', 'משאבה', 'חצר', '9.9'), name: 'Pump energy', entity_name: 'Pump energy' },
];

async function open(page: Page) {
  await installElectricityMock(page, { perms: PERMS.bills });
  // a later route wins: the candidates answer carries the duplicate "Energy" names
  await page.route('**/api/v1/energy/candidates**', async (route) => {
    const q = (new URL(route.request().url()).searchParams.get('q') ?? '').toLowerCase();
    const items = CANDIDATES.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.device_name ?? '').toLowerCase().includes(q));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items }) });
  });
  await page.goto('about:blank');
  await page.goto(url('/infra/electricity/meters', 'classic'));
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${PAGE} [data-elec="meters"][data-state="ready"]`)).toBeVisible({ timeout: 15_000 });
}

test.describe('electricity: the device name of a meter sensor', () => {
  test('picker rows: device name first, the sensor name under it, no device shows only the name, search matches the device', async ({ page }) => {
    await open(page);
    await page.locator(`${PAGE} [data-add-meter]`).first().click();
    const dlg = page.locator(`${PAGE} [data-add-dialog]`);
    const list = dlg.locator('[data-picker-list]');
    await expect(list.locator('[data-picker-item]')).toHaveCount(4);
    const boiler = list.locator('[data-picker-item="sensor.boiler_energy"]');
    await expect(boiler.locator('[data-picker-name]')).toHaveText('דוד שמש');
    await expect(boiler.locator('[data-picker-entity]')).toHaveText('Energy');
    await expect(boiler).toContainText('גג');
    await expect(list.locator('[data-picker-item="sensor.ac_energy"] [data-picker-name]')).toHaveText('מזגן סלון');
    // no device: only the sensor's own name, no second line
    const lone = list.locator('[data-picker-item="sensor.lone_energy"]');
    await expect(lone.locator('[data-picker-name]')).toHaveText('Energy');
    await expect(lone.locator('[data-picker-entity]')).toHaveCount(0);
    // the search matches the device name
    await dlg.locator('[data-picker-search]').fill('מזגן');
    await expect(list.locator('[data-picker-item]')).toHaveCount(1);
    await expect(list.locator('[data-picker-item="sensor.ac_energy"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.getAttribute('dir') ?? getComputedStyle(document.body).direction)).toBe('rtl');
  });

  test('the meters screen shows the device name with the sensor name under it', async ({ page }) => {
    await open(page);
    const phone = (page.viewportSize()?.width ?? 1440) < 900;
    const rows = page.locator(phone ? `${PAGE} [data-meters-rows] [data-meter]` : `${PAGE} [data-meters-table] tbody [data-meter]`);
    const bakery = rows.filter({ hasText: 'לוח מאפייה - פאזה 1' });
    await expect(bakery).toContainText('מונה חכם מאפייה');
    await expect(bakery.locator('[data-meter-entity]')).toHaveText('לוח מאפייה - פאזה 1');
    // a meter without a device keeps its own name and has no second line
    const elevator = rows.filter({ hasText: 'מעלית' });
    await expect(elevator).toHaveCount(1);
    await expect(elevator.locator('[data-meter-entity]')).toHaveCount(0);
    // the meter card header: the device first, the sensor under it
    await bakery.first().click();
    const drawer = page.locator(`${PAGE} [data-meter-drawer]`);
    await expect(drawer).toContainText('מונה חכם מאפייה');
    await expect(drawer).toContainText('לוח מאפייה - פאזה 1');
  });
});
