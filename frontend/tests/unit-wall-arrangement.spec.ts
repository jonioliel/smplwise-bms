import { test, expect } from '@playwright/test';
import type { Camera } from '../src/api/types';
import { isHomeRoute } from '../src/shell/nav';
import { parseRoute } from '../src/router';
import { buildPatches, canMove, moveRow, originalsOf, rowsFromCameras, setHidden, setSpan, wallCameras, wallFooterCount } from '../src/screens/wall-arrangement';

// The wall arrangement model (owner request 2026-09-30: "לא להציג" per camera) and the route scope of the user menu's
// "עריכת המסך הראשי". Node only - pure functions (src/screens/wall-arrangement.ts, src/shell/nav.ts).

const cam = (id: string, sort_order: number, extra: Partial<Camera> = {}): Camera => ({
  id, recorder_id: 'r', channel: sort_order + 1, name: `מצלמה ${id}`, name_source: 'nvr', alias: null, enabled: true, sort_order,
  grid_col_span: 1, main_track: 1, sub_track: 2, status: 'online', last_seen_at: null, ...extra,
});

test.describe('wall arrangement: hiding a camera in the wall', () => {
  const cams = [cam('a', 0), cam('b', 1, { wall_hidden: true }), cam('c', 2), cam('d', 3, { wall_hidden: true }), cam('e', 4)];

  test('the wall shows the cameras that are not hidden, in their saved order; a camera without the field is shown', () => {
    expect(wallCameras(cams).map((c) => c.id)).toEqual(['a', 'c', 'e']);
    expect(wallCameras([cam('x', 0)]).length).toBe(1);
  });

  test('the footer counts only the cameras meant to be shown: "N מצלמות" when all are on screen, else "מוצגות N מתוך M מצלמות"', () => {
    expect(wallFooterCount(12, 12)).toBe('12 מצלמות'); // 14 cameras, 2 hidden, all 12 on screen
    expect(wallFooterCount(9, 12)).toBe('מוצגות 9 מתוך 12 מצלמות'); // a 9-count button, 2 of 14 hidden
    expect(wallFooterCount(5, 5)).toBe('5 מצלמות');
    expect(wallFooterCount(0, 0)).toBe('0 מצלמות');
    expect(wallFooterCount(6, 4)).toBe('6 מצלמות'); // a map selection that includes a camera hidden in the wall
  });

  test('the dialog lists the shown cameras first and the hidden ones at the end, each group in its saved order', () => {
    const rows = rowsFromCameras(cams);
    expect(rows.map((r) => r.id)).toEqual(['a', 'c', 'e', 'b', 'd']);
    expect(rows.map((r) => r.hidden)).toEqual([false, false, false, true, true]);
  });

  test('hide: the row goes to the start of the hidden group; show again: to the end of the shown group', () => {
    const rows = rowsFromCameras(cams);
    const hidden = setHidden(rows, 0, true); // hide a
    expect(hidden.map((r) => `${r.id}${r.hidden ? '*' : ''}`)).toEqual(['c', 'e', 'a*', 'b*', 'd*']);
    const back = setHidden(hidden, 4, false); // show d again
    expect(back.map((r) => `${r.id}${r.hidden ? '*' : ''}`)).toEqual(['c', 'e', 'd', 'a*', 'b*']);
    expect(setHidden(rows, 0, false)).toBe(rows); // nothing to do: the same list back
    const all = setHidden(setHidden(rowsFromCameras([cam('p', 0), cam('q', 1)]), 0, true), 0, true);
    expect(all.map((r) => `${r.id}${r.hidden ? '*' : ''}`)).toEqual(['q*', 'p*']); // all hidden: the last one hidden leads the hidden group
  });

  test('a hidden row can still be reordered among the hidden ones, but never passes into the shown group', () => {
    const rows = rowsFromCameras(cams); // a c e b* d*
    expect(canMove(rows, 3, 1)).toBe(true);
    expect(moveRow(rows, 3, 1).map((r) => r.id)).toEqual(['a', 'c', 'e', 'd', 'b']);
    expect(canMove(rows, 3, -1)).toBe(false); // b* up into e: no
    expect(canMove(rows, 2, 1)).toBe(false); // e down into b*: no
    expect(moveRow(rows, 0, -1)).toBe(rows);
    expect(moveRow(rows, 4, 1)).toBe(rows);
    expect(moveRow(rows, 0, 1).map((r) => r.id)).toEqual(['c', 'a', 'e', 'b', 'd']);
  });

  test('the width of a hidden camera is kept', () => {
    const rows = setSpan(rowsFromCameras(cams), 3, 2);
    expect(rows[3]).toMatchObject({ id: 'b', span: 2, hidden: true });
  });

  test('save: only what changed is sent - hide one camera', () => {
    const rows = setHidden(rowsFromCameras(cams), 0, true); // c e a* b* d*
    const patches = buildPatches(rows, originalsOf(cams), cams);
    // positions: c 2->0, e 4->1, a 0->2 (+hidden), b 1->3, d 3->4
    expect(patches).toEqual([
      { id: 'c', body: { sort_order: 0 } },
      { id: 'e', body: { sort_order: 1 } },
      { id: 'a', body: { sort_order: 2, wall_hidden: true } },
      { id: 'b', body: { sort_order: 3 } },
      { id: 'd', body: { sort_order: 4 } },
    ]);
  });

  test('save: showing a camera again sends wall_hidden false; an unchanged dialog sends nothing', () => {
    const base = rowsFromCameras(cams);
    expect(buildPatches(base, originalsOf(cams), cams)).toEqual([
      // the dialog's own order (shown first) renumbers them: a 0, c 1, e 2, b 3, d 4
      { id: 'c', body: { sort_order: 1 } },
      { id: 'e', body: { sort_order: 2 } },
      { id: 'b', body: { sort_order: 3 } },
      { id: 'd', body: { sort_order: 4 } },
    ]);
    const settled = cams.map((c, i) => ({ ...c, sort_order: [0, 3, 1, 4, 2][i] })); // what the wall holds after that save
    expect(buildPatches(rowsFromCameras(settled), originalsOf(settled), settled)).toEqual([]);
    const shown = setHidden(rowsFromCameras(settled), 3, false); // b shown again
    expect(buildPatches(shown, originalsOf(settled), settled).find((p) => p.id === 'b')?.body).toEqual({ wall_hidden: false }); // it keeps its place (3): only the flag changes
  });

  test('save: a disabled camera (not in the dialog) follows the dialog rows so nothing collides', () => {
    const all = [...cams, cam('z', 2, { enabled: false })];
    const patches = buildPatches(rowsFromCameras(cams), originalsOf(cams), all);
    expect(patches.find((p) => p.id === 'z')?.body).toEqual({ sort_order: 5 });
  });
});

test.describe('the user menu: "עריכת המסך הראשי" belongs to the home screen only', () => {
  const route = (hash: string) => parseRoute(hash);

  test('the home of חשמל והתקנים, with or without a query', () => {
    expect(isHomeRoute(route('#/devices'))).toBe(true);
    expect(isHomeRoute(route('#/devices/building'))).toBe(true);
    expect(isHomeRoute(route('#/devices/building?edit=1'))).toBe(true);
    expect(isHomeRoute(route('#/devices/building?domain=lights&floor=f1'))).toBe(true);
  });

  test('every other screen is not the home', () => {
    expect(isHomeRoute(null)).toBe(false);
    expect(isHomeRoute(route('#/live/wall'))).toBe(false);
    expect(isHomeRoute(route('#/explore/floors/f0'))).toBe(false);
    expect(isHomeRoute(route('#/devices/areas/a1'))).toBe(false);
    expect(isHomeRoute(route('#/devices/schedules'))).toBe(false);
    expect(isHomeRoute(route('#/security/alarm'))).toBe(false);
  });
});
