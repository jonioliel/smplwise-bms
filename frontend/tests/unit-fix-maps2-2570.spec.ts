import { test, expect } from '@playwright/test';
import { ApiError } from '../src/api/client';
import type { BulkPreview, BulkRecord } from '../src/api/device-bulk';
import type { CreatedRoom } from '../src/plan-wizard/wizard-backend';
import { areaOfName, saveWizardRooms, type RoomsSaveBackend, type RoomToSave } from '../src/plan-wizard/wizard-rooms';
import { PinSaveFlight, savePinsOnce, type PinSaveIo } from '../src/screens/pin-save';
import { siteOffHeadline, startSiteRuns, type SitePreview } from '../src/screens/site-off-run';

// FIX-MAPS2-2570 (deep review 2.57 MH2-07): the failure paths of MH2-01 (plan wizard rooms), MH2-02 (site-wide turn off) and MH2-03
// (plan editor pin save), driven through the code the screens run (plan-wizard/wizard-rooms.ts, screens/site-off-run.ts,
// screens/pin-save.ts) with in-memory servers. Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-fix-maps2-2570.spec.ts

const apiErr = (status: number, code: string) => new ApiError(status, { code, user_message: code, retryable: false, correlation_id: 'c', details: {} });
const tick = () => new Promise<void>((r) => setTimeout(r, 2));

// ------------------------------------------------------------------------------------------------ MH2-01: the wizard's rooms step

/** The floor's rooms as the server keeps them: accept creates live rooms at once, a PATCH tags one. */
class ZoneServer implements RoomsSaveBackend {
  live = new Map<string, { name: string; tags: string[]; area: string | null }>();
  private seq = 0;
  private tags = 0;
  constructor(private readonly failTagAt: number[] = []) {}
  async acceptRooms(rooms: { polygon: { x: number; y: number }[]; name: string }[], _replaceAuto: boolean, dropFirst: string[]): Promise<CreatedRoom[]> {
    for (const id of dropFirst) this.live.delete(id);
    return rooms.map((r) => {
      const id = `z${++this.seq}`;
      this.live.set(id, { name: r.name, tags: [], area: null });
      return { id, revision: 1, polygon: r.polygon, level_id: null };
    });
  }
  async tagRoom(room: CreatedRoom, tags: string[], areaId: string | null): Promise<void> {
    await tick();
    if (this.failTagAt.includes(++this.tags)) throw apiErr(403, 'forbidden');
    const z = this.live.get(room.id);
    if (!z) throw apiErr(404, 'not_found');
    z.tags = tags;
    z.area = areaId;
  }
}

const rows = (...names: string[]): RoomToSave[] => names.map((name, i) => ({ polygon: [{ x: i, y: 0 }], name, kind: 'room', tags: ['living'], areaId: name === 'לובי' ? 'area.lobby' : null }));

test('MH2-01: a failed tag keeps the rooms just created, so "save" again replaces them - one set on the floor', async () => {
  const server = new ZoneServer([3]); // the third PATCH (the third room) is refused
  let created: CreatedRoom[] = [];
  const keep = (made: CreatedRoom[]) => (created = made);
  const err = await saveWizardRooms(server, rows('סלון', 'מטבח', 'לובי', 'חדר שינה'), false, created, keep).then(() => null, (e: unknown) => e);
  expect(err).not.toBeNull();
  // the wizard knows the rooms that are now on the floor
  expect(created.map((c) => c.id).sort()).toEqual([...server.live.keys()].sort());
  // the person presses "save" again: the first set is replaced, not doubled
  await saveWizardRooms(server, rows('סלון', 'מטבח', 'לובי', 'חדר שינה'), false, created, keep);
  expect(server.live.size).toBe(4);
  expect(created.map((c) => c.id).sort()).toEqual([...server.live.keys()].sort());
  expect([...server.live.values()].every((z) => z.tags.length === 1)).toBe(true);
});

test('MH2-01: the error names the rooms that were not tagged; the other rooms are still tagged', async () => {
  const server = new ZoneServer([2]);
  let created: CreatedRoom[] = [];
  const err = await saveWizardRooms(server, rows('סלון', 'לובי', 'מטבח'), false, created, (m) => (created = m)).then(() => null, (e: unknown) => e as Error);
  expect(err).toBeInstanceOf(Error);
  expect(String(err?.message)).toContain('לובי');
  const byName = new Map([...server.live.values()].map((z) => [z.name, z]));
  expect(byName.get('סלון')?.tags).toEqual(['living']);
  expect(byName.get('מטבח')?.tags).toEqual(['living']); // the room after the refused one was still tagged
  expect(byName.get('לובי')?.tags).toEqual([]);
  expect(created).toHaveLength(3);
});

test('MH2-01: "discard" after a failed pass reaches every room the wizard created', async () => {
  const server = new ZoneServer([1]);
  let created: CreatedRoom[] = [];
  await saveWizardRooms(server, rows('סלון', 'מטבח'), false, created, (m) => (created = m)).catch(() => undefined);
  for (const c of created) server.live.delete(c.id); // plan-wizard.ts confirmReplace -> discard(version, created ids)
  expect(server.live.size).toBe(0);
});

// ------------------------------------------------------------------------------------------------ MH2-04: room name -> area

test('MH2-04: a room links only to an area of its own building (or of no building)', () => {
  const areas = [
    { area_id: 'area.lobby_b', name: 'לובי', building_id: 'B' },
    { area_id: 'area.kitchen', name: 'מטבח', building_id: 'A' },
    { area_id: 'area.store', name: 'מחסן', building_id: null },
  ];
  expect(areaOfName(areas, 'לובי', 'A')).toBeNull(); // building B's lobby is not pulled into building A
  expect(areaOfName(areas, ' מטבח ', 'A')).toBe('area.kitchen');
  expect(areaOfName(areas, 'מחסן', 'A')).toBe('area.store'); // an area of no building yet
  expect(areaOfName(areas, 'לובי', 'B')).toBe('area.lobby_b');
  expect(areaOfName(areas, 'לובי', null)).toBe('area.lobby_b'); // the building unknown (one building): as before
  expect(areaOfName(areas, '', 'A')).toBeNull();
});

// ------------------------------------------------------------------------------------------------ MH2-02: the site-wide turn off

function record(id: string, counts: Partial<BulkRecord['counts']>, done = true): BulkRecord {
  const base = { queued: 0, accepted: 0, confirmed: 0, sent: 0, not_confirmed: 0, refused: 0, unknown: 0, total: 0 };
  return { id, scope: 'area', scope_id: id, scope_name: null, kind: 'all_off', kind_label: 'x', status: done ? 'done' : 'waiting', done, all_confirmed: false, counts: { ...base, ...counts }, items: [], note: '',
    requested_at: '2026-11-28T10:00:00Z', not_after: null, sent_at: null, done_at: null, principal_user_id: 'u', principal_username: null, origin: 'devices' } as BulkRecord;
}
const preview = (b: string, id: string): SitePreview => ({ b, p: { scope: 'area', id, kind: 'all_off', count: 2, digest: `d-${id}`, targets: [], skipped: { already: 0, unavailable: 0 } } as unknown as BulkPreview });

test('MH2-02: when the second building fails, the first building\'s run is shown and nothing more is sent', async () => {
  const sent: string[] = [];
  let shown: BulkRecord[] = [];
  const start = async (p: BulkPreview) => {
    sent.push(p.id);
    if (p.id === 'b2-area') throw apiErr(409, 'target_changed');
    return record(`run-${p.id}`, { accepted: 2, total: 2 }, false);
  };
  const err = await startSiteRuns([preview('b1', 'b1-area'), preview('b2', 'b2-area'), preview('b3', 'b3-area')], start, (r) => (shown = r)).then(() => null, (e: unknown) => e as Error & { building?: string; started?: BulkRecord[] });
  expect(err).not.toBeNull();
  expect(shown.map((r) => r.id)).toEqual(['run-b1-area']); // building 1 is already going off - the dialog follows it
  expect(sent).toEqual(['b1-area', 'b2-area']); // no retry of building 2, building 3 never sent
  expect(err?.building).toBe('b2');
  expect(err?.started?.map((r) => r.id)).toEqual(['run-b1-area']);
});

test('MH2-02: devices that were only sent are never "done"; the running count is of confirmed devices only', () => {
  expect(siteOffHeadline([record('a', { sent: 2, total: 2 }), record('b', { sent: 1, total: 1 })], true).text).toBe('נשלח');
  expect(siteOffHeadline([record('a', { confirmed: 2, total: 2 }), record('b', { sent: 1, total: 1 })], true).text).toBe('בוצע (חלק נשלחו ללא אישור)');
  expect(siteOffHeadline([record('a', { confirmed: 2, total: 2 }), record('b', { confirmed: 1, total: 1 })], true).text).toBe('בוצע');
  expect(siteOffHeadline([record('a', { confirmed: 1, sent: 1, not_confirmed: 1, total: 3 })], true)).toEqual({ tone: 'partial', text: 'בוצע חלקית: 1 לא אושרו' });
  expect(siteOffHeadline([record('a', { confirmed: 1, accepted: 2, total: 3 }, false), record('b', { sent: 2, total: 2 }, false)], false).text).toBe('1 מתוך 5 אושרו');
});

// ------------------------------------------------------------------------------------------------ MH2-03: the plan editor's pin save

type Pin = { id: string; revision: number; x: number; y: number };

/** The editor's pin state and the server's anchors (revision checked like routers/anchors.py). */
function editorWith(ids: string[]) {
  const server = new Map(ids.map((id) => [id, { revision: 1, x: 0, y: 0 }]));
  const st = { anchors: ids.map((id): Pin => ({ id, revision: 1, x: 0, y: 0 })), dirty: new Set<string>() };
  const stale: string[] = [];
  let onSend: (id: string) => void = () => undefined;
  const io: PinSaveIo<Pin> = {
    dirty: () => st.dirty,
    anchor: (id) => st.anchors.find((a) => a.id === id),
    send: async (a) => {
      onSend(a.id);
      await tick();
      const s = server.get(a.id)!;
      if (s.revision !== a.revision) {
        stale.push(a.id);
        throw apiErr(409, 'stale_revision');
      }
      Object.assign(s, { revision: s.revision + 1, x: a.x, y: a.y });
      return s.revision;
    },
    landed: (id, revision) => (st.anchors = st.anchors.map((a) => (a.id === id ? { ...a, revision } : a))),
    setDirty: (next) => (st.dirty = next),
  };
  /** explore-plan-editor.ts apply(): a new pin object, a new unsaved set. */
  const move = (id: string, x: number) => {
    st.anchors = st.anchors.map((a) => (a.id === id ? { ...a, x } : a));
    st.dirty = new Set(st.dirty).add(id);
  };
  return { server, st, io, move, stale, setOnSend: (f: (id: string) => void) => (onSend = f) };
}

test('MH2-03: a pin moved while the save runs stays unsaved (and is saved by the next save)', async () => {
  const e = editorWith(['p1', 'p2', 'p3']);
  e.move('p1', 0.1);
  e.move('p2', 0.2);
  let once = false;
  e.setOnSend((id) => {
    if (id === 'p1' && !once) {
      once = true;
      e.move('p3', 0.3); // dragged during the save
      e.move('p1', 0.15); // the pin being sent right now, moved again
    }
  });
  const r = await savePinsOnce(e.io);
  expect(r.conflict).toBe(false);
  expect([...e.st.dirty].sort()).toEqual(['p1', 'p3']); // both edits made during the save are still marked unsaved
  expect(e.server.get('p2')!.x).toBe(0.2);
  await savePinsOnce(e.io);
  expect(e.st.dirty.size).toBe(0);
  expect(e.server.get('p1')!.x).toBe(0.15);
  expect(e.server.get('p3')!.x).toBe(0.3);
  expect(e.stale).toEqual([]);
});

test('MH2-03: Ctrl+S during a save is not a conflict with itself', async () => {
  const e = editorWith(['p1', 'p2']);
  e.move('p1', 0.1);
  e.move('p2', 0.2);
  const flight = new PinSaveFlight();
  const save = () => flight.run(async () => !(await savePinsOnce(e.io)).conflict, () => e.st.dirty.size > 0);
  const [a, b] = await Promise.all([save(), save()]);
  expect(e.stale).toEqual([]); // no "another editor changed it" for our own second save
  expect(a).toBe(true);
  expect(b).toBe(true);
  expect(e.st.dirty.size).toBe(0);
  expect(e.server.get('p1')!.revision).toBe(2);
});
