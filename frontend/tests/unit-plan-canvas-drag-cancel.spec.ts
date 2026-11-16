import { test, expect, type Page } from '@playwright/test';

// CR-PLAN-CANVAS-DRAG-2440 (code review 08:F14, lead decision L10), in a real browser: a pin of an editable plan canvas is
// pressed with the real mouse (so the pointer capture is real) and dragged; a `pointercancel` in the middle of the drag
// (the browser took the gesture over) ends it WITHOUT a `marker-move` - before, the cancel was bound to the release
// handler and committed the move with the cancel event's coordinates. The control: the same drag released normally
// still emits exactly one `marker-move`. The canvas is a stand-alone element over the demo floor map (no backend).

type Canvas = HTMLElement & {
  editable: boolean;
  planWidth: number;
  planHeight: number;
  markers: { id: string; kind: string; label: string; x: number; y: number }[];
  updateComplete: Promise<boolean>;
  fit(): void;
  toScreen(x: number, y: number): { x: number; y: number };
};
type Win = Window & { __moves: { id: string; x: number; y: number }[]; __selects: number };

async function mount(page: Page): Promise<{ x: number; y: number }> {
  await page.goto('/#/explore/floors/f0');
  await expect(page.locator('explore-floor-map sw-plan-canvas')).toBeVisible({ timeout: 20000 }); // the element is defined
  return page.evaluate(async () => {
    const w = window as unknown as Win;
    w.__moves = [];
    w.__selects = 0;
    const c = document.createElement('sw-plan-canvas') as Canvas;
    c.id = 'drag-probe';
    c.style.cssText = 'position:fixed;left:40px;top:40px;width:640px;height:420px;z-index:2147483647;background:#fff;display:block';
    c.editable = true;
    c.planWidth = 1000;
    c.planHeight = 700;
    c.markers = [{ id: 'pin1', kind: 'camera', label: 'pin', x: 0.4, y: 0.5 }];
    c.addEventListener('marker-move', (e) => w.__moves.push((e as CustomEvent<{ id: string; x: number; y: number }>).detail));
    c.addEventListener('marker-select', () => w.__selects++);
    document.body.append(c);
    await c.updateComplete;
    c.fit();
    await c.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const r = c.getBoundingClientRect();
    const p = c.toScreen(0.4, 0.5);
    return { x: r.left + p.x, y: r.top + p.y };
  });
}

const state = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as Win;
    const c = document.getElementById('drag-probe') as unknown as { dragging: unknown };
    return { moves: w.__moves, selects: w.__selects, dragging: c.dragging };
  });

test('a pointercancel in the middle of a pin drag moves nothing; the listeners of the session are gone', async ({ page }) => {
  test.setTimeout(90_000);
  const at = await mount(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 60, at.y + 30, { steps: 6 });
  expect((await state(page)).dragging).not.toBeNull(); // the drag is alive: the pin follows the pointer
  // the browser takes the gesture over: a cancel event carries no pointer position (0, 0)
  await page.evaluate(() => {
    const c = document.getElementById('drag-probe')!;
    c.shadowRoot!.querySelector('.viewport')!.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, composed: true, pointerId: 1, clientX: 0, clientY: 0 }));
  });
  let s = await state(page);
  expect(s.dragging).toBeNull(); // the preview is put back
  expect(s.moves).toEqual([]); // and nothing was committed
  expect(s.selects).toBe(0);
  // what the pointer does afterwards belongs to no session
  await page.mouse.move(at.x + 120, at.y + 60, { steps: 4 });
  await page.mouse.up();
  s = await state(page);
  expect(s.dragging).toBeNull();
  expect(s.moves).toEqual([]);
});

test('the control: the same drag released normally commits one marker-move at the release point', async ({ page }) => {
  test.setTimeout(90_000);
  const at = await mount(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 60, at.y + 30, { steps: 6 });
  await page.mouse.up();
  const s = await state(page);
  expect(s.dragging).toBeNull();
  expect(s.moves.length).toBe(1);
  expect(s.moves[0].id).toBe('pin1');
  expect(s.moves[0].x).toBeGreaterThan(0.4);
  expect(s.moves[0].y).toBeGreaterThan(0.5);
  // a press without a move still selects the pin
  await page.waitForTimeout(50);
  const again = await page.evaluate(() => {
    const c = document.getElementById('drag-probe') as unknown as Canvas;
    const r = c.getBoundingClientRect();
    const p = c.toScreen(0.4, 0.5);
    return { x: r.left + p.x, y: r.top + p.y };
  });
  await page.mouse.move(again.x, again.y);
  await page.mouse.down();
  await page.mouse.up();
  const t = await state(page);
  expect(t.moves.length).toBe(1);
  expect(t.selects).toBe(1);
});
