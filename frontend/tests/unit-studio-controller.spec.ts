import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactiveControllerHost } from 'lit';
import { ApiError } from '../src/api/client';
import type { GeometryResponse, GeometryRow } from '../src/api/geometry';
import type { GeometryDoc, GeomConnector, GeomObject } from '../src/map/geometry';
import { StudioController, type StudioApi } from '../src/map/studio-controller';

// Plan Studio (T084): the editor's autosave - one save after the quiet period with the revision the server gave, undo
// saves too, and a conflict keeps the local edit and says so. Runs in node with a fake host and a fake API.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sample = () => JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;
const host = () => ({ addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) }) as unknown as ReactiveControllerHost;
const row = (revision: number, status: GeometryRow['status']): GeometryRow => ({ id: 'g1', plan_version_id: 'v1', floor_id: 'f1', status, revision, doc_hash: `h${revision}`,
  created_at: null, updated_at: null, published_at: null, published_by: null, archived_at: null });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A server holding one draft. `attempts` records the base revision of every save sent, `failOnce` makes the next save
 * fail with the given error, `elsewhere` is a save by another editor. */
function fakeApi(doc: GeometryDoc) {
  const saves: { revision: number; walls: number }[] = [];
  const attempts: number[] = [];
  let rev = 0;
  let failure: Error | null = null;
  const api: StudioApi = {
    load: async (): Promise<GeometryResponse> => ({ geometry: row(rev, rev ? 'draft' : 'new'), doc, issues: [], published_hash: null, copy_candidates: [] }),
    save: async (_id, d, base): Promise<GeometryResponse> => {
      attempts.push(base);
      const fail = failure;
      failure = null;
      if (fail) throw fail;
      if (base !== rev) throw new ApiError(409, { code: 'stale_revision', user_message: 'x', retryable: false, correlation_id: '', details: {} });
      rev += 1;
      saves.push({ revision: rev, walls: d.walls.length });
      return { geometry: row(rev, 'draft'), doc: d, issues: [], published_hash: null };
    },
  };
  const failOnce = (err: Error) => {
    failure = err;
  };
  const elsewhere = () => {
    rev += 1;
  };
  return { api, saves, attempts, failOnce, elsewhere };
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

  // The editor awaits flush() before calibrating, copying, switching versions and publishing. When an edit lands while
  // the autosave is in flight, a flush called meanwhile must also wait for the save that carries that edit.
  test('a second flush waits for the save of an edit made while the first save was in flight', async () => {
    const releases: (() => void)[] = []; // saves finish only when released, like a slow PUT
    let rev = 0;
    const api: StudioApi = {
      load: async (): Promise<GeometryResponse> => ({ geometry: row(0, 'new'), doc: sample(), issues: [], published_hash: null, copy_candidates: [] }),
      save: (_id, d) => new Promise<GeometryResponse>((resolve) => releases.push(() => {
        rev += 1;
        resolve({ geometry: row(rev, 'draft'), doc: d, issues: [], published_hash: null });
      })),
    };
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    c.commit({ ...c.doc!, walls: c.doc!.walls.slice(0, 3) });
    const autosave = c.flush(); // save 1 in flight
    c.commit({ ...c.doc!, walls: c.doc!.walls.slice(0, 2) }); // an edit while it runs
    let waited = false;
    const beforeAction = c.flush().then(() => {
      waited = true;
    });
    releases[0](); // save 1 done: the edit goes out as save 2
    await sleep(10);
    expect(releases.length).toBe(2);
    expect(waited).toBe(false);
    releases[1]();
    await Promise.all([autosave, beforeAction]);
    expect(waited).toBe(true);
    expect(c.revision).toBe(2);
    expect(c.saveState).toBe('saved');
  });

  test('after a failed save each explicit flush tries once more, and flush says whether everything is saved', async () => {
    const { api, attempts, failOnce } = fakeApi(sample());
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    failOnce(new ApiError(503, { code: 'http_503', user_message: 'y', retryable: true, correlation_id: '', details: {} }));
    c.commit({ ...c.doc!, walls: c.doc!.walls.slice(0, 2) });
    expect(await c.flush()).toBe(false);
    expect(c.saveState).toBe('error');
    expect(c.error).toBe('y');
    await sleep(60); // the failure does not re-arm the autosave
    expect(attempts).toEqual([0]);
    expect(await c.flush()).toBe(true);
    expect(attempts).toEqual([0, 0]);
    expect(c.saveState).toBe('saved');
    expect(c.revision).toBe(1);
  });

  test('after a conflict nothing is sent until the editor reloads, then edits save on the reloaded revision', async () => {
    const { api, attempts, elsewhere } = fakeApi(sample());
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    elsewhere(); // another editor saved: the server is at revision 1
    c.commit({ ...c.doc!, walls: c.doc!.walls.slice(0, 3) });
    expect(await c.flush()).toBe(false);
    expect(attempts).toEqual([0]);
    c.commit({ ...c.doc!, walls: c.doc!.walls.slice(0, 2) });
    expect(c.saveState).toBe('error');
    await sleep(60); // no autosave
    expect(await c.flush()).toBe(false); // and no explicit save either
    expect(attempts).toEqual([0]);
    expect(c.saveState).toBe('error');
    expect(c.doc!.walls.length).toBe(2);
    await c.load('v1');
    expect(c.saveState).toBe('idle');
    expect(c.revision).toBe(1);
    c.commit({ ...c.doc!, walls: c.doc!.walls.slice(0, 1) });
    expect(await c.flush()).toBe(true);
    expect(attempts).toEqual([0, 1]);
    expect(c.revision).toBe(2);
    expect(c.saveState).toBe('saved');
  });

  test('undo keeps exactly the last 60 steps', async () => {
    const { api } = fakeApi(sample());
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    for (let i = 1; i <= 61; i++) c.commit({ ...c.doc!, meta: { ...c.doc!.meta, generator: `edit ${i}` } });
    for (let i = 0; i < 60; i++) {
      expect(c.canUndo).toBe(true);
      c.undo();
    }
    expect(c.canUndo).toBe(false);
    expect(c.doc!.meta.generator).toBe('edit 1'); // the loaded document is the step that fell off
    await c.flush();
  });

  test('pendingPublish counts objects and connectors, as the server does', async () => {
    const bare: GeometryDoc = { ...sample(), walls: [], openings: [], labels: [], objects: [], connectors: [] };
    const shows = async (doc: GeometryDoc) => {
      const c = new StudioController(host(), fakeApi(doc).api, 20);
      await c.load('v1');
      return c.pendingPublish;
    };
    expect(await shows({ ...bare, objects: [{ id: 'o1' } as unknown as GeomObject] })).toBe(true);
    expect(await shows({ ...bare, connectors: [{ id: 'c1' } as unknown as GeomConnector] })).toBe(true);
    expect(await shows(bare)).toBe(false);
  });

  // T085 task 11: the server derives the connector of an object that connects levels and recomputes circuit power; the
  // editor takes both from the save answer, but only while nothing changed since the save went out.
  test('a save answer brings the server-derived connectors and circuit power, unless a local edit came after the save', async () => {
    const releases: ((extra?: Partial<GeometryDoc>) => void)[] = [];
    let rev = 0;
    const api: StudioApi = {
      load: async (): Promise<GeometryResponse> => ({ geometry: row(0, 'new'), doc: sample(), issues: [], published_hash: null, copy_candidates: [] }),
      save: (_id, d) => new Promise<GeometryResponse>((resolve) => releases.push(() => {
        rev += 1;
        const derived = { id: 'cx-o9', kind: 'tribune', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.1, 0.1], [0.1, 0.2]], width_m: 2, label: null, object_id: 'o9', source: 'auto', external_ids: {} } as unknown as GeomConnector;
        resolve({ geometry: row(rev, 'draft'), doc: { ...d, walls: [], connectors: [...d.connectors, derived], circuits: d.circuits.map((k) => ({ ...k, power_w: 999, member_ids: [] })) }, issues: [], published_hash: null });
      })),
    };
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    c.commit({ ...c.doc!, labels: [] });
    const undoSteps = c.canUndo;
    const saving = c.flush();
    releases[0]();
    await saving;
    expect(c.doc!.connectors.map((x) => x.id)).toContain('cx-o9');
    expect(c.doc!.circuits[0].power_w).toBe(999);
    expect(c.revision).toBe(1); // revision and hash are the answer's
    expect(c.hash).toBe('h1');
    expect(c.saveState).toBe('saved');
    expect(c.doc!.circuits[0].member_ids).toEqual(sample().circuits[0].member_ids); // only the power: the members are the editor's
    expect(c.doc!.walls.length).toBe(sample().walls.length); // walls, openings, labels and objects stay the local ones
    expect(c.doc!.labels).toEqual([]);
    expect(c.canUndo).toBe(undoSteps);
    c.undo();
    expect(c.canUndo).toBe(false); // the adoption added no undo step
    const afterUndo = c.flush();
    releases[1]();
    await afterUndo;
    // an edit made while the save is in flight: that answer is not taken over (the next save brings it again)
    await c.load('v1');
    c.commit({ ...c.doc!, labels: [] });
    const second = c.flush();
    await sleep(5);
    c.commit({ ...c.doc!, walls: c.doc!.walls.slice(0, 1) });
    releases[2]();
    await sleep(5);
    expect(c.doc!.connectors.map((x) => x.id)).not.toContain('cx-o9');
    expect(c.doc!.walls.length).toBe(1);
    expect(releases.length).toBe(4); // the later edit goes out as its own save
    releases[3]();
    await second;
    expect(c.doc!.connectors.map((x) => x.id)).toContain('cx-o9'); // that answer brings the derived connector
    expect(c.doc!.walls.length).toBe(1);
    expect(c.revision).toBe(4);
    expect(c.saveState).toBe('saved');
  });

  // Loads and saves answer only when the test says so, to replay the races of switching and reloading versions.
  test('an overtaken load and a save answered after a newer load change nothing', async () => {
    const answer: Record<string, (r: GeometryResponse) => void> = {};
    const reply = (id: string, revision: number): GeometryResponse =>
      ({ geometry: { ...row(revision, 'draft'), plan_version_id: id, doc_hash: `${id}-h${revision}` }, doc: sample(), issues: [], published_hash: null });
    const api: StudioApi = {
      load: (id) => new Promise<GeometryResponse>((resolve) => {
        answer[`load ${id}`] = resolve;
      }),
      save: (id) => new Promise<GeometryResponse>((resolve) => {
        answer[`save ${id}`] = resolve;
      }),
    };
    const c = new StudioController(host(), api, 20);
    const first = c.load('v1');
    answer['load v1'](reply('v1', 3));
    await first;
    c.commit({ ...c.doc!, walls: [] });
    const saving = c.flush(); // the save of v1 is in flight
    const toV2 = c.load('v2');
    const toV3 = c.load('v3'); // overtakes the load of v2
    answer['load v3'](reply('v3', 9));
    await toV3;
    answer['load v2'](reply('v2', 5)); // answered late: ignored
    await toV2;
    expect(c.hash).toBe('v3-h9');
    answer['save v1'](reply('v1', 4)); // answered after v3 loaded: ignored
    expect(await saving).toBe(true);
    expect(c.revision).toBe(9);
    expect(c.hash).toBe('v3-h9');
    expect(c.saveState).toBe('idle');
    // A reload of the same version too: its answer is the state, not a save answered after it. The reload may have
    // been read before that save landed; taking the save's revision over the reloaded document would let the next
    // save overwrite the saved edit unnoticed, while keeping the reloaded revision makes it a visible conflict.
    c.commit({ ...c.doc!, walls: [] });
    const saving2 = c.flush();
    const reload = c.load('v3');
    answer['load v3'](reply('v3', 9));
    await reload;
    answer['save v3'](reply('v3', 10));
    expect(await saving2).toBe(true);
    expect(c.revision).toBe(9);
    expect(c.hash).toBe('v3-h9');
  });

  // Plan Studio phase 3 (T086): the detection accept edits the draft on the server; its answer is taken like a save's.
  test('adopt takes a server-edited draft as one undo step, and the undo saves on the adopted revision', async () => {
    const { api, saves, elsewhere } = fakeApi(sample());
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    const before = c.doc!;
    elsewhere(); // the accept saved revision 1 on the server
    const merged = { ...before, walls: [...before.walls, { ...before.walls[0], id: 'auto-w1', source: 'auto' as const }] };
    c.adopt({ geometry: row(1, 'draft'), doc: merged, issues: [], published_hash: null });
    expect(c.revision).toBe(1);
    expect(c.hash).toBe('h1');
    expect(c.doc).toBe(merged);
    expect(c.saveState).toBe('saved');
    expect(c.canUndo).toBe(true);
    expect(await c.flush()).toBe(true); // nothing left to save
    expect(saves).toEqual([]);
    c.undo();
    await sleep(80);
    expect(saves).toEqual([{ revision: 2, walls: before.walls.length }]);
  });
});
