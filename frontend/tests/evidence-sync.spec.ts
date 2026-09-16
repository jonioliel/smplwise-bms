import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for T042 (multi-camera sync with a measured drift) against the running developer backend and the lab
// NVR: a playback group with 2–4 cameras passes the opening barrier, a master clock takes over, each tile's
// rendered time is measured against it (p95 over a sliding window), the quality is shown, the measurement reaches
// the server, and speeds the source cannot deliver are disabled. Real Chrome (SW_CHROME=1), SW_LIVE=1 only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T042-sync-live');

const DEEP = `const deep = (root, sel) => { const r = root.querySelector(sel); if (r) return r; for (const el of root.querySelectorAll('*')) { if (el.shadowRoot) { const f = deep(el.shadowRoot, sel); if (f) return f; } } return null; };
const all = (root, sel, out = []) => { out.push(...root.querySelectorAll(sel)); for (const el of root.querySelectorAll('*')) if (el.shadowRoot) all(el.shadowRoot, sel, out); return out; };`;

interface PlayerState {
  cameraId: string;
  status: string;
  width: number;
}
interface SyncView {
  quality: string;
  p95: string;
  samples: number;
  groupId: string | null;
  members: Record<string, { p95: number | null; samples: number; resyncs: number; state: string }> | null;
  tiles: { camera: string; state: string; text: string }[];
  speeds: { speed: string; disabled: boolean; title: string }[];
}

const players = (page: Page): Promise<PlayerState[]> =>
  page.evaluate(`(() => { ${DEEP} return all(document, 'sw-live-player').map(p => ({cameraId: p.cameraId, status: p.status, width: p.shadowRoot.querySelector('video').videoWidth})); })()`);

const syncView = (page: Page): Promise<SyncView> =>
  page.evaluate(`(() => { ${DEEP} const s = deep(document, 'investigate-playback'); const q = deep(s.shadowRoot, '[data-sync-quality]');
    return { quality: q ? q.dataset.syncQuality : 'none', p95: q ? q.dataset.syncP95 : '', samples: q ? Number(q.dataset.syncSamples) : 0, groupId: s.group ? s.group.id : null,
      members: s.syncStats ? s.syncStats.members : null,
      tiles: all(s.shadowRoot, '[data-tile]').map(t => ({ camera: t.dataset.tile, state: t.dataset.tileState, text: t.textContent.trim() })),
      speeds: all(s.shadowRoot, '[data-speed]').map(b => ({ speed: b.dataset.speed, disabled: b.disabled, title: b.title })) }; })()`);

test.describe('multi-camera sync (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('barrier, master clock, measured p95 drift, quality, server report, unsupported speeds disabled', async ({ page, request }, testInfo) => {
    test.setTimeout(240_000);
    const cams = (await (await request.get('/api/v1/cameras')).json()).cameras.filter((c: { status: string; main_track: number | null }) => c.status === 'online' && c.main_track);
    test.skip(cams.length < 2, 'need two online cameras');
    const tz = (await (await request.get('/api/v1/settings')).json()).settings['time.zone'] ?? 'Asia/Jerusalem';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    // pick up to four cameras that recorded 20 minutes ago
    const at = new Date(Date.now() - 20 * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const covered: string[] = [];
    for (const c of cams) {
      const rec = await (await request.get(`/api/v1/cameras/${c.id}/recordings?date=${today}`)).json();
      if (rec.segments.some((s: { start_at: string; end_at: string }) => s.start_at <= at && s.end_at >= at)) covered.push(c.id);
      if (covered.length === 4) break;
    }
    test.skip(covered.length < 2, 'need two cameras with a recording 20 minutes ago');
    // start from a clean quota: release any playback session of this user left over from an earlier run
    for (const s of (await (await request.get('/api/v1/playback/sessions')).json()).sessions as { id: string }[]) await request.delete(`/api/v1/playback/sessions/${s.id}`);
    await page.goto(`/#/investigate/playback?camera=${covered[0]}&t=${encodeURIComponent(at)}`);
    await page.waitForSelector('sw-app');
    let deadline = Date.now() + 75_000;
    while (Date.now() < deadline && !(await players(page)).some((p) => p.status === 'playing' && p.width > 0)) await page.waitForTimeout(1000);
    expect((await players(page)).some((p) => p.status === 'playing' && p.width > 0), 'the lead camera plays before the group is formed').toBe(true);
    for (const extra of covered.slice(1)) {
      await page.evaluate(`(async () => { ${DEEP} const s = deep(document, 'investigate-playback'); await s.toggleExtra('${extra}'); })()`);
      await page.waitForTimeout(1500);
    }
    // the barrier passes, the clock runs, samples accumulate
    let view = await syncView(page);
    deadline = Date.now() + 60_000;
    while (Date.now() < deadline && !(view.quality !== 'waiting' && view.quality !== 'none' && view.samples >= 16)) {
      await page.waitForTimeout(1000);
      view = await syncView(page);
    }
    await page.screenshot({ path: path.join(OUT, `sync-${testInfo.project.name}.png`) });
    testInfo.annotations.push({ type: 'sync', description: JSON.stringify({ cameras: covered.length, view: { ...view, tiles: view.tiles.map((t) => t.state) } }) });
    expect(['synced', 'slight', 'out_of_sync']).toContain(view.quality);
    expect(Number(view.p95)).toBeGreaterThanOrEqual(0);
    expect(view.samples).toBeGreaterThanOrEqual(16);
    expect(view.members && Object.keys(view.members).length).toBeGreaterThanOrEqual(2);
    for (const m of Object.values(view.members ?? {})) expect(['measured', 'late', 'waiting']).toContain(m.state);
    // the measurement reached the server on the group itself
    expect(view.groupId).toBeTruthy();
    deadline = Date.now() + 15_000;
    let stored: { sync_report: { p95_s: number | null; quality: string; samples: number; members: Record<string, unknown> } | null } = { sync_report: null };
    while (Date.now() < deadline) {
      stored = await (await request.get(`/api/v1/playback/groups/${view.groupId}`)).json();
      if (stored.sync_report) break;
      await page.waitForTimeout(1000);
    }
    expect(stored.sync_report).toBeTruthy();
    expect(['synced', 'slight', 'out_of_sync']).toContain(stored.sync_report!.quality);
    expect(Object.keys(stored.sync_report!.members).length).toBeGreaterThanOrEqual(2);
    testInfo.annotations.push({ type: 'server-report', description: JSON.stringify(stored.sync_report) });
    // let the group settle (member re-seeks cost a stream start each) and record where it ends up, without asserting a quality
    deadline = Date.now() + 45_000;
    let final = view;
    while (Date.now() < deadline) {
      await page.waitForTimeout(5000);
      final = await syncView(page);
      if (final.quality === 'synced') break;
    }
    await page.screenshot({ path: path.join(OUT, `sync-final-${testInfo.project.name}.png`) });
    testInfo.annotations.push({ type: 'sync-final', description: JSON.stringify({ ...final, tiles: final.tiles.map((x) => x.state) }) });
    // only 1× is offered in a group; the others are disabled with the reason
    expect(view.speeds.find((s) => s.speed === '1')?.disabled).toBe(false);
    expect(view.speeds.filter((s) => s.speed !== '1').every((s) => s.disabled && s.title.length > 0)).toBe(true);
    await page.evaluate(`(async () => { ${DEEP} const s = deep(document, 'investigate-playback'); await s.endSession(); })()`);
  });
});
