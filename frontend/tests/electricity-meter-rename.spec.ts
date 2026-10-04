import { test, expect, type Page } from '@playwright/test';
import { installElectricityMock, PERMS, url } from './electricity-mocks';
import { checkMeterName, METER_NAME_MAX } from '../src/electricity/meter-name';

// A friendly name for every meter: asked for when the meter is created (pre-filled from the device / sensor name) and renamed afterwards from the
// meter card. Mocked backend, fake names only. Runs on all three projects.

const PAGE = 'sw-app elec-meters-page';
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 900;
const rows = (page: Page) => page.locator(isPhone(page) ? `${PAGE} [data-meters-rows] [data-meter]` : `${PAGE} [data-meters-table] tbody [data-meter]`);

async function open(page: Page, perms: string[] = PERMS.bills) {
  const mock = await installElectricityMock(page, { perms });
  await page.goto('about:blank');
  await page.goto(url('/infra/electricity/meters', 'classic'));
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${PAGE} [data-elec="meters"][data-state="ready"]`)).toBeVisible({ timeout: 15_000 });
  return mock;
}

async function openCard(page: Page, label: string, id: string) {
  await rows(page).filter({ hasText: label }).first().click();
  const card = page.locator(`${PAGE} elec-meter-card [data-meter-card="${id}"]`);
  await expect(card).toBeVisible({ timeout: 15_000 });
  return card;
}

test.describe('meter name rules (pure)', () => {
  test('trimmed, required, at most 120, a name another meter has is refused', () => {
    expect(checkMeterName('   ', [])).toMatchObject({ name: '', duplicate: false });
    expect(checkMeterName('   ', []).error).not.toBe('');
    expect(checkMeterName('  מעלית  ', [])).toEqual({ name: 'מעלית', error: '', duplicate: false });
    expect(checkMeterName('x'.repeat(METER_NAME_MAX), []).error).toBe('');
    expect(checkMeterName('x'.repeat(METER_NAME_MAX + 1), []).error).not.toBe('');
    expect(checkMeterName('Lift', ['lift '])).toMatchObject({ duplicate: true });
    expect(checkMeterName('Lift', ['lift ']).error).toContain('קיים כבר מונה בשם הזה');
    expect(checkMeterName('Lift', ['Lift 2']).duplicate).toBe(false);
  });
});

test.describe('electricity: naming a meter when it is created', () => {
  test('the name is pre-filled from the device, required, and sent with the create', async ({ page }) => {
    const mock = await open(page);
    await page.locator(`${PAGE} [data-add-meter]`).first().click();
    const dlg = page.locator(`${PAGE} [data-add-dialog]`);
    await dlg.locator('[data-picker-search]').fill('חדר כושר');
    await dlg.locator('[data-picker-item="sensor.gym_energy"]').click();
    const input = dlg.locator('[data-add-name]');
    await expect(input).toHaveValue('מונה חכם חדר כושר');
    // empty: refused on the screen, nothing is sent
    await input.fill('   ');
    await dlg.locator('[data-add-confirm]').click();
    await expect(dlg.locator('[data-add-name-error]')).toBeVisible();
    expect(mock.calls.some((c) => c.method === 'POST' && c.path === 'meters')).toBe(false);
    // a name that is already used (a paused meter's name counts too) is refused: message, and the button does not proceed
    await input.fill('  מעלית ');
    await expect(dlg.locator('[data-add-name-error]')).toContainText('קיים כבר מונה בשם הזה');
    await expect(dlg.locator('[data-add-confirm]')).toHaveAttribute('disabled', '');
    await input.fill('חניון - תאורה');
    await expect(dlg.locator('[data-add-name-error]')).toContainText('לא ניתן להקים שני מונים באותו שם');
    expect(mock.calls.some((c) => c.method === 'POST' && c.path === 'meters')).toBe(false);
    // the typed name is trimmed
    await input.fill('  חדר כושר ראשי ');
    await expect(dlg.locator('[data-add-name-error]')).toHaveCount(0);
    await dlg.locator('[data-add-confirm]').click();
    await expect(page.locator(`${PAGE} [data-notice]`)).toContainText('המונה נוסף');
    const post = mock.calls.find((c) => c.method === 'POST' && c.path === 'meters');
    expect((post?.body as { display_name?: string }).display_name).toBe('חדר כושר ראשי');
    await expect(rows(page).filter({ hasText: 'חדר כושר ראשי' })).toHaveCount(1);
  });
});

test.describe('electricity: renaming a meter', () => {
  test('rename from the card: validation, the sealed-bills hint, duplicate warning, saved and shown in the list', async ({ page }) => {
    const mock = await open(page);
    const card = await openCard(page, 'מעלית', 'm9');
    await card.locator('[data-meter-rename]').click();
    const dlg = page.locator(`${PAGE} elec-meter-card [data-meter-rename-dialog]`);
    const input = dlg.locator('[data-rename-input]');
    await expect(input).toHaveValue('מעלית');
    await expect(dlg.locator('[data-rename-hint]')).toContainText('חשבוניות שכבר הונפקו לא ישתנו');
    await input.fill('');
    await dlg.locator('[data-rename-save]').click();
    await expect(dlg.locator('[data-rename-error]')).toBeVisible();
    expect(mock.calls.some((c) => c.method === 'PATCH' && c.path.startsWith('meters/m9'))).toBe(false);
    await input.fill('x'.repeat(121));
    await dlg.locator('[data-rename-save]').click();
    await expect(dlg.locator('[data-rename-error]')).toContainText('120');
    // another meter's name is refused (the save button is off and nothing is sent)
    await input.fill('לוח סטודיו');
    await expect(dlg.locator('[data-rename-dup]')).toContainText('קיים כבר מונה בשם הזה, לא ניתן להקים שני מונים באותו שם');
    await expect(dlg.locator('[data-rename-save]')).toHaveAttribute('disabled', '');
    await input.press('Enter');
    expect(mock.calls.some((c) => c.method === 'PATCH' && c.path.startsWith('meters/m9'))).toBe(false);
    await input.fill('  מעלית ראשית ');
    await expect(dlg.locator('[data-rename-dup]')).toHaveCount(0);
    await input.press('Enter');
    await expect(dlg).not.toHaveAttribute('open', '');
    const patch = mock.calls.find((c) => c.method === 'PATCH' && c.path.startsWith('meters/m9'));
    expect(patch?.body).toMatchObject({ display_name: 'מעלית ראשית', revision: 1 });
    await expect(page.locator(`${PAGE} [data-meter-drawer]`)).toContainText('מעלית ראשית');
    await expect(rows(page).filter({ hasText: 'מעלית ראשית' })).toHaveCount(1);
  });

  test('the server refuses a colliding name even when the screen did not know (another operator renamed first)', async ({ page }) => {
    const mock = await open(page);
    const card = await openCard(page, 'מעלית', 'm9');
    await card.locator('[data-meter-rename]').click();
    const dlg = page.locator(`${PAGE} elec-meter-card [data-meter-rename-dialog]`);
    const other = mock.meters.find((x) => x.id === 'm3');
    if (!other) throw new Error('fixture meter m3 missing');
    await expect(dlg.locator('[data-rename-input]')).toHaveValue('מעלית');
    await page.waitForTimeout(600); // the dialog has read the other meters' names by now
    other.display_name = 'שם חדש של אחר'; // renamed behind the screen's back, after the dialog read the list
    await dlg.locator('[data-rename-input]').fill('שם חדש של אחר');
    await dlg.locator('[data-rename-save]').click();
    await expect(dlg.locator('[data-rename-error]')).toContainText('קיים כבר מונה בשם הזה');
    expect(mock.meters.find((x) => x.id === 'm9')?.display_name).toBe('מעלית');
  });

  test('a conflict (someone else changed the meter) says so in Hebrew and refreshes the card', async ({ page }) => {
    const mock = await open(page);
    const card = await openCard(page, 'מעלית', 'm9');
    await card.locator('[data-meter-rename]').click();
    const dlg = page.locator(`${PAGE} elec-meter-card [data-meter-rename-dialog]`);
    await dlg.locator('[data-rename-input]').fill('מעלית חדשה');
    const m = mock.meters.find((x) => x.id === 'm9');
    if (!m) throw new Error('fixture meter m9 missing');
    m.revision += 1; // another operator got there first
    await dlg.locator('[data-rename-save]').click();
    await expect(dlg.locator('[data-rename-error]')).toContainText('מישהו אחר שינה');
    // the dialog stays open with the typed name; saving again works against the refreshed revision
    await expect(dlg.locator('[data-rename-input]')).toHaveValue('מעלית חדשה');
    await dlg.locator('[data-rename-save]').click();
    await expect(dlg).not.toHaveAttribute('open', '');
    expect(m.display_name).toBe('מעלית חדשה');
  });

  test('without energy.manage there is no rename action', async ({ page }) => {
    await open(page, PERMS.view);
    const card = await openCard(page, 'מעלית', 'm9');
    await expect(card.locator('[data-meter-rename]')).toHaveCount(0);
  });

  test('keyboard: the rename button is reachable and the field is focused', async ({ page }) => {
    await open(page);
    const card = await openCard(page, 'מעלית', 'm9');
    const btn = card.locator('[data-meter-rename] button');
    await btn.focus();
    await page.keyboard.press('Enter');
    const input = page.locator(`${PAGE} elec-meter-card [data-meter-rename-dialog] [data-rename-input]`);
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    const box = await input.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
  });
});
