import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactiveControllerHost } from 'lit';
import { ApiError } from '../src/api/client';
import type { GeometryResponse, GeometryRow } from '../src/api/geometry';
import type { GeometryDoc } from '../src/map/geometry';
import { StudioController, type StudioApi } from '../src/map/studio-controller';

// Plan Studio (T084): the editor's autosave - one save after the quiet period with the revision the server gave, undo
// saves too, and a conflict keeps the local edit and says so. Runs in node with a fake host and a fake API.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sample = () => JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;
const host = () => ({ addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) }) as unknown as ReactiveControllerHost;
const row = (revision: number, status: GeometryRow['status']): GeometryRow => ({ id: 'g1', plan_version_id: 'v1', floor_id: 'f1', status, revision, doc_hash: `h${revision}`,
  created_at: null, updated_at: null, published_at: null, published_by: null, archived_at: null });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeApi(doc: GeometryDoc) {
  const saves: { revision: number; walls: number }[] = [];
  let rev = 0;
  const api: StudioApi = {
    load: async (): Promise<GeometryResponse> => ({ geometry: row(0, 'new'), doc, issues: [], published_hash: null, copy_candidates: [] }),
    save: async (_id, d, base): Promise<GeometryResponse> => {
      if (base !== rev) throw new ApiError(409, { code: 'stale_revision', user_message: 'x', retryable: false, correlation_id: '', details: {} });
      rev += 1;
      saves.push({ revision: rev, walls: d.walls.length });
      return { geometry: row(rev, 'draft'), doc: d, issues: [], published_hash: null };
    },
  };
  return { api, saves };
}

test.describe('studio controller (unit)', () => {
  test('edits are saved once after the quiet period, in order, with the right base revision', async () => {
    const { api, saves } = fakeApi(sample());
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    c.commit({ ...c.doc!, walls: c.doc!.walls.slice(0, 3) });
    c.commit({ ...c.doc!, walls: c.doc!.walls.slice(0, 2) });
    expect(c.saveState).toBe('pending');
    await sleep(80);
    expect(saves).toEqual([{ revision: 1, walls: 2 }]);
    expect(c.saveState).toBe('saved');
    c.undo();
    await c.flush();
    expect(saves.at(-1)).toEqual({ revision: 2, walls: 3 });
    expect(c.revision).toBe(2);
    expect(c.canRedo).toBe(true);
  });

  test('a conflict keeps the local edit and reports it', async () => {
    const { api } = fakeApi(sample());
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    c.revision = 5; // another editor saved meanwhile
    c.commit({ ...c.doc!, walls: [] });
    await c.flush();
    expect(c.saveState).toBe('error');
    expect(c.error).toContain('במקום אחר');
    expect(c.doc!.walls).toEqual([]);
  });

  test('pendingPublish: only when the draft differs from what viewers see and there is something to show', async () => {
    const { api } = fakeApi(sample());
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    expect(c.pendingPublish).toBe(true); // the sample has walls, nothing is published
    c.publishedHash = c.hash;
    expect(c.pendingPublish).toBe(false);
  });
});
