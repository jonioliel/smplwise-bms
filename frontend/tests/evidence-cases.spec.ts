import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for investigation cases (T049) against the running developer backend and the lab NVR: an event is
// added to a new case from the event page, a clip from the playback screen, a note from the case itself; the
// case reports each item's preservation honestly (NVR-only bookmark → preserving → preserved after an export job
// copied the footage; never "preserved" for footage the NVR no longer has). Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T049-cases-live');

interface Item { id: string; kind: string; preservation: string; camera_id: string | null; from_at: string | null }
interface Detail { id: string; title: string; status: string; revision: number; items: Item[]; counts: { items: number; preserved: number }; checked: boolean }

test.describe('investigation cases (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('event → new case, clip from playback, note, preservation states', async ({ page, request }, testInfo) => {
    test.setTimeout(300000);
    const events = (await (await request.get('/api/v1/events?limit=50')).json()).events as { id: string; camera_id: string | null; occurred_at: string; type: string }[];
    const ev = events.find((e) => e.camera_id && Date.now() - new Date(e.occurred_at).getTime() > 90000);
    expect(ev, 'an event with a camera, at least 90 s old').toBeTruthy();
    const title = `ראיות T049 ${new Date().toISOString().slice(11, 19)}`;

    // 1) event page → "הוסף לתיק" → new case
    await open(page, `/investigate/events/${ev!.id}`);
    const evPage = page.locator('investigate-event-detail');
    await expect(evPage.locator('[data-add-to-case]')).toBeVisible({ timeout: 20000 });
    await evPage.locator('[data-add-to-case]').click();
    const picker = evPage.locator('sw-case-picker');
    await expect(picker.locator('[data-case-select]')).toBeVisible({ timeout: 15000 });
    await picker.locator('[data-case-select]').selectOption('new');
    await picker.locator('[data-case-new-title]').fill(title);
    await page.screenshot({ path: path.join(OUT, `picker-${testInfo.project.name}.png`) });
    await picker.locator('[data-case-confirm]').click();
    await expect(picker.locator('[data-case-added]')).toBeVisible({ timeout: 15000 });
    await picker.locator('[data-case-open]').click();
    await page.waitForTimeout(1500);
    const url = page.url();
    const caseId = url.split('/investigate/cases/')[1]?.split(/[?&#]/)[0] ?? '';
    expect(caseId, 'navigated to the new case').toBeTruthy();
    const detail = page.locator('investigate-case-detail');
    await expect(detail.locator('[data-case-item][data-kind="event"]')).toBeVisible({ timeout: 20000 });
    const caseOf = async () => (await (await request.get(`/api/v1/cases/${caseId}`)).json()) as Detail;
    let d = await caseOf();
    expect(d.title).toBe(title);
    expect(d.items.length).toBe(1);
    expect(d.checked).toBe(true);
    expect(['nvr_only', 'missing', 'unknown']).toContain(d.items[0].preservation);
    testInfo.annotations.push({ type: 'event-item', description: `preservation after the NVR check: ${d.items[0].preservation}` });

    // 2) a note from the case page
    await detail.locator('[data-note-text]').fill('נבדק במסגרת ראיות T049 — הערה אוטומטית');
    await detail.locator('[data-note-add]').click();
    await expect(detail.locator('[data-case-item][data-kind="note"]')).toBeVisible({ timeout: 15000 });

    // 3) a clip from the playback screen at the event time (existing case picked)
    await open(page, `/investigate/playback?camera=${ev!.camera_id}&t=${encodeURIComponent(ev!.occurred_at)}`);
    const pb = page.locator('investigate-playback');
    await expect(pb.locator('[data-add-to-case]')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);
    await pb.locator('[data-add-to-case]').click();
    const picker2 = pb.locator('sw-case-picker');
    await expect(picker2.locator('[data-case-select]')).toBeVisible({ timeout: 15000 });
    await picker2.locator('[data-case-select]').selectOption(caseId);
    await picker2.locator('[data-case-confirm]').click();
    await expect(picker2.locator('[data-case-added]')).toBeVisible({ timeout: 15000 });
    d = await caseOf();
    expect(d.items.map((i) => i.kind).sort()).toEqual(['clip', 'event', 'note']);
    const clip = d.items.find((i) => i.kind === 'clip')!;
    expect(['nvr_only', 'missing', 'unknown']).toContain(clip.preservation);

    // 4) the case page shows all three with their preservation badges
    await open(page, `/investigate/cases/${caseId}`);
    await expect(detail.locator('[data-case-item]')).toHaveCount(3, { timeout: 20000 });
    await page.screenshot({ path: path.join(OUT, `case-detail-${testInfo.project.name}.png`), fullPage: true });

    // 5) preserve the clip: an export job copies it out of the NVR; the item is "preserving" and then "preserved"
    const clipRow = detail.locator(`[data-case-item][data-kind="clip"]`);
    if (clip.preservation === 'nvr_only') {
      await clipRow.locator('[data-item-preserve]').click();
      await expect(clipRow).toHaveAttribute('data-preservation', /preserving|preserved/, { timeout: 20000 });
      // real footage export (remux + copy off a live NVR) took about 4:49 in the lab (2026-09-26, round 10) against
      // this test's original 180 s bound tuned for the demo backend's near-instant fake job; 480 s leaves headroom
      await expect.poll(async () => (await caseOf()).items.find((i) => i.kind === 'clip')?.preservation, { timeout: 480000, intervals: [5000] }).toMatch(/preserved|unknown|nvr_only/);
      const finalClip = (await caseOf()).items.find((i) => i.kind === 'clip')!;
      testInfo.annotations.push({ type: 'preserve', description: `clip after the export job: ${finalClip.preservation}` });
      expect(finalClip.preservation, 'a finished copy is preserved; a failed job falls back to the NVR-only truth').not.toBe('missing');
      await open(page, `/investigate/cases/${caseId}`);
      await expect(detail.locator('[data-case-item][data-kind="clip"]')).toHaveAttribute('data-preservation', finalClip.preservation, { timeout: 20000 });
      await page.screenshot({ path: path.join(OUT, `case-preserved-${testInfo.project.name}.png`), fullPage: true });
    } else {
      testInfo.annotations.push({ type: 'preserve', description: `skipped: the clip is ${clip.preservation}` });
    }

    // 6) status + revision: closing the case through the UI, a stale revision is refused by the API
    await detail.locator('[data-case-status]').selectOption('closed');
    await expect.poll(async () => (await caseOf()).status, { timeout: 15000 }).toBe('closed');
    const stale = await request.patch(`/api/v1/cases/${caseId}`, { data: { revision: 1, title: 'x' } });
    expect(stale.status()).toBe(409);
    await open(page, '/investigate/cases');
    await expect(page.locator('investigate-cases [data-cases-table]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('investigate-cases')).toContainText(title);
    await page.screenshot({ path: path.join(OUT, `cases-list-${testInfo.project.name}.png`) });

    // 7) clean up the evidence case (export files stay under /data/exports until retention)
    expect((await request.delete(`/api/v1/cases/${caseId}`)).status()).toBe(204);
  });
});
