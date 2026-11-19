import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { FrameCoalescer, type FrameEnv } from '../src/components/frame-coalescer';
import { browserSession, browserStorage, dropStored, readStoredJson, storeText, storedText, writeStoredJson, type StorageLike } from '../src/api/safe-storage';

// CR-FE-NITS-2442 (code review 06, frontend chain step FE-4): the small findings NOOP-1, STORE-1, TIMER-1 (rest), RESIZE-1 (rest), RTL-1.
// Node only. The pure pieces (safe storage, the frame coalescer) are run; how the screens use them is checked in the source, as the
// other screen guards do (unit-floor-map-state, unit-shell-timers) - the screens are Lit elements and need a browser to run.
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

/** The body of a class member, from its header line to the next member at the same indent. */
function member(code: string, header: string): string {
  const from = code.indexOf(header);
  expect(from, header).toBeGreaterThanOrEqual(0);
  const end = code.indexOf('\n  }\n', from);
  expect(end, `${header}: end`).toBeGreaterThan(from);
  return code.slice(from, end);
}

// ------------------------------------------------------------------------------------------------ 06:NOOP-1

test('NOOP-1: the no-op ternary, the unused parameters, the double imports and the duplicate glyphs are gone', () => {
  expect(src('screens/automation-editor-base.ts')).not.toContain('f.maybe_saved ? `${f.message}` : f.message');
  expect(src('screens/schedule-editor.ts')).toContain('private overlapIdx(a: EditSlot, b: EditSlot): boolean {');
  expect(src('screens/devices-building.ts')).toContain('private onAreaLink(e: MouseEvent, id: string) {');
  expect(src('screens/devices-layout.ts')).toContain('private setPickAll(on: boolean) {');
  // the corner radius is read from the input when "apply" is pressed: no closure variable is written on every change
  const panel = src('screens/plan-studio-panel.ts');
  expect(panel).toContain('const typed = Math.min(0.5, max);');
  expect(panel).not.toMatch(/typed = parseFloat/);
  // live-camera: every module once, and the <sw-field> it renders is imported by the file that renders it
  const cam = src('screens/live-camera.ts');
  const imports = cam.split('\n').filter((l) => l.startsWith('import '));
  const from = imports.map((l) => /from '([^']+)';$/.exec(l)?.[1] ?? /^import '([^']+)';$/.exec(l)?.[1] ?? l);
  const sideEffect = imports.filter((l) => /^import '/.test(l));
  expect(new Set(sideEffect).size, 'a side-effect import written twice').toBe(sideEffect.length);
  expect(from.filter((m) => m === '../api/nvr').length).toBe(1);
  expect(cam).toContain('<sw-field');
  expect(sideEffect).toContain("import '../components/sw-field';");
  // home widgets: one drawing per glyph
  const hw = src('screens/home-widgets.ts');
  expect(hw).toContain('const WIND = GLYPHS.wind;');
  expect(hw).toContain('const HAVDALAH = GLYPHS.moon;');
  // system-diagnostics: each doc comment sits on its own method (two stood stacked on the wrong one)
  const diag = src('screens/system-diagnostics.ts');
  expect(diag).toMatch(/could only fail\. \*\/\n {2}private renderNvrLessNotice\(/);
  expect(diag).toMatch(/like the other switches\. \*\/\n {2}private async toggleLocalSafety\(/);
  expect(diag).not.toMatch(/\*\/\n {2}\/\*\* POLISH4-WP7/);
  expect(diag).not.toMatch(/\*\/\n {2}\/\*\* OFFBOX-RESTORE-2300 \(owner answer 2026-10-30\)/);
});

// ------------------------------------------------------------------------------------------------ 06:STORE-1

/** A storage over a map; `broken` makes every call throw (a private window, blocked site data, a full quota). */
function fakeStorage(seed: Record<string, string> = {}, broken = false) {
  const m = new Map(Object.entries(seed));
  const fail = () => {
    throw new Error('storage refused');
  };
  const s: StorageLike = {
    getItem: (k) => (broken ? fail() : m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void (broken ? fail() : m.set(k, v)),
    removeItem: (k) => void (broken ? fail() : m.delete(k)),
  };
  return { s, m };
}

test('STORE-1: text and JSON round-trip through a storage', () => {
  const { s, m } = fakeStorage();
  expect(storedText('a', s)).toBeNull();
  storeText('a', 'week', s);
  expect(storedText('a', s)).toBe('week');
  expect(m.get('a')).toBe('week'); // text is stored as it is, not as JSON
  writeStoredJson('f', { q: 'x', on: true }, s);
  expect(m.get('f')).toBe('{"q":"x","on":true}');
  expect(readStoredJson<{ q: string; on: boolean }>('f', s)).toEqual({ q: 'x', on: true });
  dropStored('a', s);
  expect(storedText('a', s)).toBeNull();
  expect(m.has('a')).toBe(false);
});

test('STORE-1: nothing stored, an empty text and a text that is not JSON all read as null', () => {
  const { s } = fakeStorage({ empty: '', raw: 'rows', bad: '{"a":' });
  expect(readStoredJson('missing', s)).toBeNull();
  expect(readStoredJson('empty', s)).toBeNull();
  expect(readStoredJson('raw', s)).toBeNull(); // devices-schedules reads its old raw view value with storedText after this null
  expect(storedText('raw', s)).toBe('rows');
  expect(readStoredJson('bad', s)).toBeNull();
  expect(storedText('empty', s)).toBe(''); // an empty text is a stored value (settings-cards: "no card open")
});

test('STORE-1: a storage that throws, or no storage at all, never throws to the caller', () => {
  const { s } = fakeStorage({ a: '1' }, true);
  for (const storage of [s, null]) {
    expect(storedText('a', storage)).toBeNull();
    expect(readStoredJson('a', storage)).toBeNull();
    expect(() => storeText('a', '2', storage)).not.toThrow();
    expect(() => writeStoredJson('a', { x: 1 }, storage)).not.toThrow();
    expect(() => dropStored('a', storage)).not.toThrow();
  }
  // a value that cannot be serialised is not remembered either
  const { s: ok, m } = fakeStorage();
  const loop: Record<string, unknown> = {};
  loop.self = loop;
  expect(() => writeStoredJson('loop', loop, ok)).not.toThrow();
  expect(m.has('loop')).toBe(false);
});

test('STORE-1: where there is no browser storage (node) the door answers null, and one that throws on the read is null too', () => {
  expect(browserStorage()).toBeNull();
  expect(browserSession()).toBeNull();
  const g = globalThis as Record<string, unknown>;
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(g, name, { configurable: true, get: () => { throw new Error('SecurityError'); } });
  }
  try {
    expect(browserStorage()).toBeNull();
    expect(browserSession()).toBeNull();
    expect(storedText('a')).toBeNull(); // the default storage is the browser's
    expect(() => storeText('a', '1')).not.toThrow();
  } finally {
    delete g.localStorage;
    delete g.sessionStorage;
  }
  const { s } = fakeStorage({ a: '1' });
  Object.defineProperty(g, 'localStorage', { configurable: true, value: s });
  try {
    expect(browserStorage()).toBe(s);
    expect(storedText('a')).toBe('1');
  } finally {
    delete g.localStorage;
  }
});

test('STORE-1: the screens use the shared door, and the two wall keys no longer share a name', () => {
  const HAND_ROLLED = /\b(?:window\.)?(?:localStorage|sessionStorage)\b/;
  for (const f of ['screens/schedule-editor.ts', 'screens/devices-schedules.ts', 'screens/system-access-parity.ts']) {
    const code = src(f);
    expect(code, f).toContain("from '../api/safe-storage';");
    expect(HAND_ROLLED.test(code), `${f}: touches the storage itself`).toBe(false);
  }
  const sched = src('screens/schedule-editor.ts');
  expect(sched).not.toContain('function safeSession(');
  // the editor's stash and the "new schedule" hand-off are per tab: they stay in the session storage
  expect(sched.match(/, browserSession\(\)\)/g)?.length).toBe(7);
  const list = src('screens/devices-schedules.ts');
  expect(list).not.toMatch(/function (store|readStored|writeStored)\(/);
  // the cards' module keeps its export (system-diagnostics and its tests import it from there), now the shared one
  const cards = src('access-control/settings-cards-logic.ts');
  expect(cards).toContain("export { browserStorage } from '../api/safe-storage';");
  expect(cards).not.toContain('export function browserStorage(');
  expect(src('screens/system-access-parity.ts')).not.toContain('function browserStorage(');
  // one name, one key
  const wall = src('screens/live-wall.ts');
  expect(wall).toContain("export const WALL_STREAM_KEY = 'sw.wall.quality';"); // the stored key is unchanged: a device keeps its choice
  expect(wall).not.toMatch(/const WALL_QUALITY_KEY|Item\(WALL_QUALITY_KEY/); // the old name is left only in the comment that tells it
  expect(src('map/wall-plan-mode.ts')).toContain("export const WALL_QUALITY_KEY = 'sw.plan3d.wall_quality';");
});

// ------------------------------------------------------------------------------------------------ 06:TIMER-1 (the rest)

test('TIMER-1: devices-area drops the "structure changed" badge timer, and the badge, on disconnect', () => {
  const off = member(src('screens/devices-area.ts'), '  disconnectedCallback() {');
  expect(off).toContain('window.clearTimeout(this.flashTimer);');
  expect(off).toContain('this.flashTimer = 0;');
  expect(off).toContain('this.structureFlash = false;'); // nothing is left to hide it: a re-attached screen would show it for good
});

test('TIMER-1: the quick sheet keeps one flick timer, restarted by the next release and cleared on disconnect', () => {
  const qs = src('screens/area-quick-sheet.ts');
  expect(qs).not.toContain("window.setTimeout(() => this.removeAttribute('data-flick'), OPEN_MS)"); // the untracked timer
  expect(qs).toMatch(/window\.clearTimeout\(this\.flickTimer\);[^\n]*\n\s+this\.flickTimer = window\.setTimeout\(/);
  expect(qs.match(/this\.flickTimer = window\.setTimeout\(/g)?.length).toBe(1);
  const off = member(qs, '  disconnectedCallback() {');
  expect(off).toContain('window.clearTimeout(this.flickTimer);');
  expect(off).toContain("this.removeAttribute('data-flick');");
});

test('TIMER-1: the layout editor - a card\'s long press and a tile\'s long press have a timer each', () => {
  const lay = src('screens/devices-layout.ts');
  // one arming site per timer: the card's in onDown, the tile's in onTDown
  expect(lay.match(/this\.pressTimer = window\.setTimeout\(/g)?.length).toBe(1);
  expect(lay.match(/this\.tilePressTimer = window\.setTimeout\(/g)?.length).toBe(1);
  expect(member(lay, '  private onDown(e: PointerEvent, key: string) {')).toContain('this.pressTimer = window.setTimeout(');
  const tdown = member(lay, '  private onTDown(e: PointerEvent, key: string, id: string) {');
  expect(tdown).toContain('this.tilePressTimer = window.setTimeout(');
  expect(tdown).not.toContain('this.pressTimer');
  // ending a tile gesture clears the tile's timer only (it used to clear the card's as well)
  const end = member(lay, '  private endTileDrag() {');
  expect(end).toContain('window.clearTimeout(this.tilePressTimer);');
  expect(end).not.toContain('this.pressTimer');
  // and both go when the host leaves the page
  const off = member(lay, '  hostDisconnected() {');
  expect(off).toContain('window.clearTimeout(this.pressTimer);');
  expect(off).toContain('this.endTileDrag();');
});

test('TIMER-1: the plan editor clears its two search debounces on disconnect', () => {
  const off = member(src('screens/explore-plan-editor.ts'), '  disconnectedCallback() {');
  expect(off).toContain('window.clearTimeout(this.entTimer);');
  expect(off).toContain('window.clearTimeout(this.circuitTimer);');
});

test('TIMER-1: the wall arms its size watch in connectedCallback, where disconnectedCallback drops it', () => {
  const wall = src('screens/live-wall.ts');
  expect(wall).not.toMatch(/\n {2}firstUpdated\(/); // ran once in the element's life: a wall attached again was not measured
  const on = member(wall, '  connectedCallback() {');
  expect(on).toContain('this.ro = new ResizeObserver(() => this.measure());');
  expect(on).toContain('this.ro.observe(this);');
  expect(on).toContain("window.addEventListener('resize', this.measure);");
  const off = member(wall, '  disconnectedCallback() {');
  expect(off).toContain('this.ro?.disconnect();');
  expect(off).toContain('this.ro = undefined;');
  expect(off).toContain("window.removeEventListener('resize', this.measure);");
  // nothing else adds the listener or builds the observer
  expect(wall.match(/addEventListener\('resize', this\.measure\)/g)?.length).toBe(1);
  expect(wall.match(/new ResizeObserver\(/g)?.length).toBe(1);
});

// ------------------------------------------------------------------------------------------------ 06:RESIZE-1 (the rest)

/** Animation frames by hand: `frame()` runs what was booked, as the browser does once per frame. */
function fakeFrames() {
  let seq = 0;
  const booked = new Map<number, () => void>();
  const env: FrameEnv = {
    request: (run) => {
      booked.set(++seq, run);
      return seq;
    },
    cancel: (h) => void booked.delete(h),
  };
  const frame = () => {
    const due = [...booked.values()];
    booked.clear();
    for (const run of due) run();
  };
  return { env, frame, booked: () => booked.size, requests: () => seq };
}

test('RESIZE-1: a run of calls inside one frame is one run, and the next frame starts a new count', () => {
  const f = fakeFrames();
  let runs = 0;
  const c = new FrameCoalescer(() => runs++, f.env);
  expect(c.pending).toBe(false);
  for (let i = 0; i < 40; i++) c.schedule(); // a window dragged by its edge: many resize events before the frame
  expect(runs).toBe(0); // nothing runs inside the event
  expect(f.requests()).toBe(1); // one frame booked, not forty
  expect(c.pending).toBe(true);
  f.frame();
  expect(runs).toBe(1);
  expect(c.pending).toBe(false);
  f.frame(); // an idle frame runs nothing
  expect(runs).toBe(1);
  c.schedule();
  c.schedule();
  f.frame();
  expect(runs).toBe(2);
  expect(f.requests()).toBe(2);
});

test('RESIZE-1: cancel drops the booked frame (disconnect), and the coalescer works again afterwards (re-attach)', () => {
  const f = fakeFrames();
  let runs = 0;
  const c = new FrameCoalescer(() => runs++, f.env);
  c.schedule();
  c.cancel();
  expect(f.booked()).toBe(0); // the frame itself is released, not only ignored
  expect(c.pending).toBe(false);
  f.frame();
  expect(runs).toBe(0); // nothing runs on an element that left the page
  c.cancel(); // twice is harmless
  c.schedule();
  f.frame();
  expect(runs).toBe(1);
});

test('RESIZE-1: a call made by the run itself books the next frame, not a loop in this one', () => {
  const f = fakeFrames();
  let runs = 0;
  const c: FrameCoalescer = new FrameCoalescer(() => {
    if (++runs === 1) c.schedule();
  }, f.env);
  c.schedule();
  f.frame();
  expect(runs).toBe(1);
  expect(c.pending).toBe(true);
  f.frame();
  expect(runs).toBe(2);
  expect(c.pending).toBe(false);
});

test('RESIZE-1: schedule is usable as the listener itself (detached from its object)', () => {
  const f = fakeFrames();
  let runs = 0;
  const { schedule } = new FrameCoalescer(() => runs++, f.env);
  schedule();
  schedule();
  f.frame();
  expect(runs).toBe(1);
});

test('RESIZE-1: the four screens coalesce their window resize work and cancel it on disconnect', () => {
  const SCREENS: [file: string, listener: string][] = [
    ['screens/devices-building.ts', 'onResize'],
    ['screens/devices-area.ts', 'onFitResize'],
    ['screens/devices-schedules.ts', 'onResize'],
    ['screens/area-quick-sheet.ts', 'onResize'],
  ];
  for (const [f, listener] of SCREENS) {
    const code = src(f);
    expect(code, f).toContain("import { FrameCoalescer } from '../components/frame-coalescer';");
    expect(code, f).toContain('private resizeFrame = new FrameCoalescer(() =>');
    expect(code, f).toContain(`window.addEventListener('resize', this.${listener});`);
    const off = member(code, '  disconnectedCallback() {');
    expect(off, f).toContain(`window.removeEventListener('resize', this.${listener});`);
    expect(off, f).toContain('this.resizeFrame.cancel();');
  }
  // the three screens: the listener IS the coalescer (no work in the raw event)
  expect(src('screens/devices-building.ts')).toContain('private onResize = this.resizeFrame.schedule;');
  expect(src('screens/devices-area.ts')).toContain('private onFitResize = this.resizeFrame.schedule;');
  expect(src('screens/devices-schedules.ts')).toContain('private onResize = this.resizeFrame.schedule;');
  // the quick sheet: nothing at all while it is closed - in the event and again in the frame (it may close in between)
  const qs = src('screens/area-quick-sheet.ts');
  expect(qs).toMatch(/private onResize = \(\) => \{\n(?:\s+\/\/[^\n]*\n)*\s+if \(this\.open\) this\.resizeFrame\.schedule\(\);\n {2}\};/);
  expect(qs).toMatch(/private resizeFrame = new FrameCoalescer\(\(\) => \{\n\s+if \(!this\.open\) return;/);
  // updated() still places the sheet on every update, so the one that opens it uses the current viewport
  expect(member(qs, '  protected updated(changed: PropertyValues<this>) {')).toContain('this.applyRest();');
});

// ------------------------------------------------------------------------------------------------ 06:RTL-1

/** The declarations of the first rule whose selector line is `selector {`. */
function rule(code: string, selector: string): string {
  const from = code.indexOf(`${selector} {`);
  expect(from, selector).toBeGreaterThanOrEqual(0);
  return code.slice(from, code.indexOf('}', from));
}

test('RTL-1: the one physical margin is logical now, inside a track that is left-to-right in every language', () => {
  const map = src('screens/investigate-history-map.ts');
  expect(rule(map, '    .track')).toContain('direction: ltr;'); // time runs left to right: the start edge IS the left one
  const wrap = rule(map, '    .track .tlwrap');
  expect(wrap).toContain('margin-inline-start: calc(var(--sw-lanes-label-w) + 8px);');
  expect(wrap).not.toContain('margin-left');
  expect(wrap).not.toMatch(/\n\s+direction:/); // the wrapper keeps the track's direction, so the used margin is the same one
  expect(map).toContain('<div class="track">');
  expect(map).toMatch(/<div class="tlwrap">\n\s+<sw-timeline /);
});

test('RTL-1: the physical alignments that stay are all on left-to-right content (code, JSON, raw attributes)', () => {
  // each of these aligns text that is LTR by its own rule (or by its wrapper / its dir attribute): physical is the correct value
  const LTR_RULES: [file: string, selector: string][] = [
    ['screens/automation-code.ts', '      textarea'],
    ['screens/explore-entities.ts', '    .attrs'],
    ['screens/system-fleet-report.ts', '    pre.json'],
    ['screens/system-notices.ts', '      .link code'],
  ];
  for (const [f, sel] of LTR_RULES) {
    const r = rule(src(f), sel);
    expect(r, `${f} ${sel}`).toContain('direction: ltr;');
    expect(r, `${f} ${sel}`).toMatch(/text-align: (left|start);/); // CR-FE-SMALL-2440 made them logical: start = left on LTR content
  }
  const conn = src('screens/system-video-conn-test.ts');
  expect(conn).toMatch(/direction: ltr;\n\s+text-align: (left|start);\n\s+white-space: pre-wrap;/);
  // the code editor's line numbers: right-aligned against the code, inside the editor's LTR wrapper
  const code = src('screens/automation-code.ts');
  expect(rule(code, '      .wrap')).toContain('direction: ltr;');
  expect(rule(code, '      .nums')).toMatch(/text-align: (right|end);/);
  // the locked YAML block is rendered with dir="ltr"
  const forms = src('screens/automation-block-forms.ts');
  expect(forms).toContain('<div class="lockcode" data-locked-code dir="ltr">');
  expect(rule(forms, '  .lockcode')).toMatch(/text-align: (left|start);/);
});
