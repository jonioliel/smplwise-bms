import { test, expect, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { DAYS, P, R, localIso, mockRooms, open, openResidentBar } from './dst-timeline-2540-mocks';

// DST-TIMELINE-2540: on the two DST-change days of Asia/Jerusalem the rooms timeline ("rooms by hours") and the resident's time bar drew
// every entry after the change one hour off its hour label, and a tap opened a booking an hour off the hour under the finger, although
// the stored time was right. The axis is now built by the clock: an entry sits under its own hour, the hour the clock skips (spring) has
// no label and is hatched, the hour it repeats (autumn) is labelled once with "×2". API mode with mocked answers (fake rooms and entries).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-dst-timeline-2540.spec.ts --project=desktop --project=mobile --workers=2

const proj = () => test.info().project.name;

const cx = async (page: Page, sel: string) => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`no box: ${sel}`);
  return b.x + b.width / 2;
};
const left = async (page: Page, sel: string) => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`no box: ${sel}`);
  return b.x;
};

for (const d of DAYS) {
  test(`rooms timeline ${d.date} (${d.kind}): entries sit under their own hour label, a tap books the hour under the finger`, async ({ page }) => {
    test.skip(proj() !== 'desktop', 'the desktop window 07-23');
    await mockRooms(page, { entries: (date) => [
      { id: 'e10', start: localIso(date, 10), end: localIso(date, 11), title: 'ראיון' },
      { id: 'e21', start: localIso(date, 21), end: localIso(date, 22), title: 'ערב קהילה' },
    ] });
    await open(page, `/calendars/rooms?date=${d.date}`, '2026-06-10T12:00:00+03:00');
    await expect(page.locator(`${P} [data-cal-entry="e10"]`)).toBeVisible();
    await settle(page);
    // the label "10:00" is centred on 10:00; the entry starts there (elapsed time put it under 11:00 on the autumn day, 09:00 in spring)
    for (const [h, id] of [[10, 'e10'], [21, 'e21']] as const) {
      const lab = await cx(page, `${P} [data-cal-hour="${h}"]`);
      const ent = await left(page, `${P} [data-cal-entry="${id}"]`);
      expect(Math.abs(ent - lab), `${id} vs the ${h}:00 label`).toBeLessThan(4);
    }
    await expect(page.locator(`${P} [data-cal-gap]`), 'no skipped hour inside 07-23').toHaveCount(0);
    // a tap at the 14:00 label opens the new booking at 14:00 (by the clock)
    const track = page.locator(`${P} [data-cal-room="a"] .tl-track`);
    const tb = await track.boundingBox();
    if (!tb) throw new Error('no track');
    await page.mouse.click((await cx(page, `${P} [data-cal-hour="14"]`)) + 4, tb.y + 4);
    await expect(page.locator('sw-app calendars-page cal-event-drawer [data-cal-field="from"]')).toHaveValue('14:00');
    await expect(page.locator('sw-app calendars-page cal-event-drawer [data-cal-field="to"]')).toHaveValue('15:00');
  });
}

test('rooms timeline, phone, spring night 00-06: no "02" label, the skipped hour hatched, 04:00 under "04"', async ({ page }) => {
  test.skip(proj() !== 'mobile', 'the phone window of six hours');
  await mockRooms(page, { manage: true, entries: (date) => [{ id: 'n4', start: localIso(date, 4), end: localIso(date, 5) }] });
  await open(page, '/calendars/rooms?date=2026-03-27', '2026-03-20T00:30:00+02:00'); // 00:30 -> the window 00-06 (not today: no now pill)
  await expect(page.locator(`${P} [data-cal-window]`)).toContainText('00:00–06:00');
  await expect(page.locator(`${P} [data-cal-entry="n4"]`)).toBeVisible();
  await settle(page);
  const hours = await page.locator(`${P} [data-cal-hour]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-cal-hour')));
  expect(hours).toEqual(['0', '1', '3', '4', '5', '6']);
  await expect(page.locator(`${P} [data-cal-room="a"] [data-cal-gap="2"]`)).toHaveCount(1);
  const gap = await page.locator(`${P} [data-cal-room="a"] [data-cal-gap="2"]`).boundingBox();
  const lab3 = await cx(page, `${P} [data-cal-hour="3"]`);
  expect(gap && Math.abs(gap.x + gap.width - lab3), 'the hatch ends at 03:00').toBeLessThan(4);
  expect(Math.abs((await left(page, `${P} [data-cal-entry="n4"]`)) - (await cx(page, `${P} [data-cal-hour="4"]`)))).toBeLessThan(4);
});

test('rooms timeline, phone, autumn night 00-06: "01 ×2" once, both passes of 01:00 drawn at 01:00 on two lanes', async ({ page }) => {
  test.skip(proj() !== 'mobile', 'the phone window of six hours');
  await mockRooms(page, { manage: true, entries: (date) => [
    { id: 'p1', start: localIso(date, 1), end: localIso(date, 1, 30) },
    { id: 'p2', start: localIso(date, 1, 0, 60), end: localIso(date, 1, 30, 60) }, // the second pass
    { id: 'n4', start: localIso(date, 4), end: localIso(date, 5) },
  ] });
  await open(page, '/calendars/rooms?date=2026-10-25', '2026-10-20T00:30:00+03:00');
  await expect(page.locator(`${P} [data-cal-entry="p2"]`)).toBeVisible();
  await settle(page);
  const rep = page.locator(`${P} [data-cal-hour="1"]`);
  await expect(rep).toHaveCount(1);
  await expect(rep).toHaveAttribute('data-cal-hour-kind', 'repeated');
  await expect(rep).toContainText('01 ×2');
  await expect(rep).toHaveAttribute('title', 'השעה 01:00 עוברת פעמיים ביום הזה (השעון זז שעה אחורה)');
  const l1 = await cx(page, `${P} [data-cal-hour="1"]`);
  for (const id of ['p1', 'p2']) expect(Math.abs((await left(page, `${P} [data-cal-entry="${id}"]`)) - l1), id).toBeLessThan(4);
  const [b1, b2] = [await page.locator(`${P} [data-cal-entry="p1"]`).boundingBox(), await page.locator(`${P} [data-cal-entry="p2"]`).boundingBox()];
  expect(b1 && b2 && Math.abs(b1.y - b2.y), 'two lanes, not one entry over the other').toBeGreaterThan(8);
  expect(Math.abs((await left(page, `${P} [data-cal-entry="n4"]`)) - (await cx(page, `${P} [data-cal-hour="4"]`)))).toBeLessThan(4);
  await expect(page.locator(`${P} [data-cal-gap]`)).toHaveCount(0);
});

test('resident time bar, spring night: no "02", the hatch, the note, entries and the tap by the clock', async ({ page }) => {
  test.skip(proj() !== 'mobile', 'the resident flow is the phone layout');
  await openResidentBar(page, '2026-03-27', 'spring', (date) => [{ id: 'n4', start: localIso(date, 4), end: localIso(date, 5) }]);
  const T = `${R} [data-res-timeline]`;
  await settle(page);
  const hours = await page.locator(`${T} .axis span`).evaluateAll((els) => els.map((e) => e.textContent?.trim()));
  expect(hours).toEqual(['00', '01', '03', '04', '05', '06']);
  await expect(page.locator(`${T} [data-res-gap="2"]`)).toHaveCount(1);
  await expect(page.locator(`${T} [data-res-dst="missing"]`)).toHaveText('השעה 02:00 לא קיימת ביום הזה (השעון זז שעה קדימה)');
  // the busy 04:00-05:00 starts under "04"
  expect(Math.abs((await left(page, `${T} .bar .e`)) - (await cx(page, `${T} .axis span:text-is("04")`)))).toBeLessThan(4);
  // a tap under "05" with one hour centres 04:30-05:30 (elapsed time made it 05:30-06:30)
  await page.locator(`${R} [data-res-dur="60"]`).click();
  const bar = await page.locator(`${T} [data-res-bar]`).boundingBox();
  if (!bar) throw new Error('no bar');
  await page.mouse.click(await cx(page, `${T} .axis span:text-is("05")`), bar.y + bar.height / 2);
  await expect(page.locator(`${T} [data-res-tlsel]`)).toContainText('04:30–05:30');
});

test('resident time bar, autumn night: "01 ×2" once, the note, the tap by the clock', async ({ page }) => {
  test.skip(proj() !== 'mobile', 'the resident flow is the phone layout');
  await openResidentBar(page, '2026-10-25', 'autumn', (date) => [{ id: 'n4', start: localIso(date, 4), end: localIso(date, 5) }]);
  const T = `${R} [data-res-timeline]`;
  await settle(page);
  const hours = await page.locator(`${T} .axis span`).evaluateAll((els) => els.map((e) => e.textContent?.trim()));
  expect(hours).toEqual(['00', '01 ×2', '02', '03', '04', '05', '06']);
  await expect(page.locator(`${T} [data-res-dst="repeated"]`)).toHaveText('השעה 01:00 עוברת פעמיים ביום הזה (השעון זז שעה אחורה)');
  await expect(page.locator(`${T} [data-res-gap]`)).toHaveCount(0);
  expect(Math.abs((await left(page, `${T} .bar .e`)) - (await cx(page, `${T} .axis span:text-is("04")`)))).toBeLessThan(4);
  await page.locator(`${R} [data-res-dur="60"]`).click();
  const bar = await page.locator(`${T} [data-res-bar]`).boundingBox();
  if (!bar) throw new Error('no bar');
  // a tap under "03" with one hour centres 02:30-03:30 (elapsed time made it the second 01:30)
  await page.mouse.click(await cx(page, `${T} .axis span:text-is("03")`), bar.y + bar.height / 2);
  await expect(page.locator(`${T} [data-res-tlsel]`)).toContainText('02:30–03:30');
});

test('an ordinary day is unchanged: 24 plain hours, no hatch, no note', async ({ page }) => {
  test.skip(proj() !== 'mobile', 'the resident flow is the phone layout');
  await openResidentBar(page, '2026-06-11', 'autumn', (date) => [{ id: 'n4', start: localIso(date, 4), end: localIso(date, 5) }]);
  const T = `${R} [data-res-timeline]`;
  const hours = await page.locator(`${T} .axis span`).evaluateAll((els) => els.map((e) => e.textContent?.trim()));
  expect(hours).toEqual(['00', '01', '02', '03', '04', '05', '06']);
  await expect(page.locator(`${T} [data-res-gap]`)).toHaveCount(0);
  await expect(page.locator(`${T} [data-res-dst]`)).toHaveCount(0);
  expect(Math.abs((await left(page, `${T} .bar .e`)) - (await cx(page, `${T} .axis span:text-is("04")`)))).toBeLessThan(4);
});
