import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for door–camera–sensor correlation (T053) against the running developer backend: the correlation of a
// real camera event lists the HA sensors / locks placed around the camera on the floor plan, the links in the time
// window with their certainty, the notes (delayed clock, missing state) and the no-automatic-action policy; the
// event page shows the card. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T053-correlation-live');

interface Corr { spatial: boolean; entities: { name: string }[]; links: { certainty: string; kind: string }[]; notes: { code: string }[]; policy: string; location: { zone: string | null } | null }

test.describe('door–camera–sensor correlation (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('correlation of a real event and the event page card', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const events = (await (await request.get('/api/v1/events?limit=150')).json()).events as { id: string; camera_id: string | null; source: string }[];
    expect(events.length).toBeGreaterThan(0);
    const haEvents = events.filter((e) => e.source === 'ha');
    testInfo.annotations.push({ type: 'ha-transitions', description: `${haEvents.length} HA sensor transitions among the last ${events.length} events` });
    // prefer an event whose camera has placed sensors / locks around it
    let picked: { id: string; corr: Corr } | null = null;
    let fallback: { id: string; corr: Corr } | null = null;
    for (const e of events.filter((x) => x.camera_id).slice(0, 60)) {
      const r = await request.get(`/api/v1/events/${e.id}/correlation`);
      expect(r.status()).toBe(200);
      const corr = (await r.json()) as Corr;
      fallback ??= { id: e.id, corr };
      if (corr.entities.length) {
        picked = { id: e.id, corr };
        break;
      }
    }
    const chosen = picked ?? fallback!;
    const c = chosen.corr;
    expect(c.policy).toContain('אינה מופעלת אוטומטית');
    for (const l of c.links) expect(['measured', 'inferred', 'command', 'availability']).toContain(l.certainty);
    testInfo.annotations.push({ type: 'correlation', description: `spatial=${c.spatial} zone=${c.location?.zone ?? '-'} entities=${c.entities.map((e) => e.name).join(',')} links=${c.links.length} notes=${c.notes.map((n) => n.code).join(',')}` });

    await page.goto(`/?design=a#/investigate/events/${chosen.id}`);
    await page.waitForSelector('sw-app');
    const card = page.locator('investigate-event-detail [data-correlation]');
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card.locator('[data-correlation-entities]')).toBeVisible({ timeout: 20000 });
    if (c.entities.length) await expect(card).toContainText(c.entities[0].name);
    await expect(card).toContainText('אינה מופעלת אוטומטית');
    await expect(card.locator('[data-correlation-link]')).toHaveCount(c.links.length);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `event-correlation-${testInfo.project.name}.png`), fullPage: true });
  });
});
