import { test, expect } from '@playwright/test';
import { attachWiskey, wiskeyPanelUrl, WISKEY_DISCOVERY_MS, WISKEY_DISCOVERY_RETRIES, WISKEY_DISCOVERY_RETRY_MS, type WiskeyConnectorOptions, type WiskeyFrame, type WiskeyHost } from '../src/wiskey/embed-connector';
import { cleanWiskeyView, parseWiskeyDensity, parseWiskeyWall, resolveWiskeyView, sameWiskeyView } from '../src/wiskey/embed-view';

// T054 / WisKey embed API v1 (WisKey 2.0.0-rc.19): the typed connector ported from the WisKey developers' reference
// adapter (docs/integrations/wiskey/embed-api-v1/examples/wiskey-embed-client.mjs). Node only: a fake window with a
// manual clock and a fake frame - no browser, no jsdom.

const ORIGIN = 'http://ha.test:8123';

class FakeHost implements WiskeyHost {
  location = { origin: ORIGIN };
  listeners = new Set<(e: MessageEvent) => void>();
  now = 0;
  private seq = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  addEventListener(_type: 'message', l: (e: MessageEvent) => void) {
    this.listeners.add(l);
  }
  removeEventListener(_type: 'message', l: (e: MessageEvent) => void) {
    this.listeners.delete(l);
  }
  setTimeout(fn: () => void, ms: number) {
    this.seq += 1;
    this.timers.set(this.seq, { at: this.now + ms, fn });
    return this.seq;
  }
  clearTimeout(id: number | undefined) {
    if (id !== undefined) this.timers.delete(id);
  }
  advance(ms: number) {
    const end = this.now + ms;
    for (;;) {
      const next = [...this.timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.timers.delete(next[0]);
      this.now = next[1].at;
      next[1].fn(); // may schedule another timer, which runs too when it falls due before `end`
    }
    this.now = end;
  }
  get pending() {
    return this.timers.size;
  }
  /** A message as the browser would deliver it to the host window. */
  deliver(data: unknown, from: { origin?: string; source?: unknown } = {}) {
    const event = { data, origin: from.origin ?? ORIGIN, source: from.source } as unknown as MessageEvent;
    for (const l of [...this.listeners]) l(event);
  }
}

class FakeFrameWindow {
  posted: { message: unknown; target: string }[] = [];
  location = { origin: ORIGIN };
  postMessage(message: unknown, target: string) {
    this.posted.push({ message, target });
  }
}

/** A minimal element tree: light children, an optional open shadow root, attributes. */
class FakeEl {
  children: FakeEl[] = [];
  shadowRoot: FakeRoot | null = null;
  constructor(
    public tag: string,
    private attrs: Record<string, string> = {},
  ) {}
  hasAttribute(name: string) {
    return name in this.attrs;
  }
  getAttribute(name: string) {
    return this.attrs[name] ?? null;
  }
}
class FakeRoot {
  constructor(public children: FakeEl[] = []) {}
  private all(): FakeEl[] {
    const out: FakeEl[] = [];
    const walk = (els: FakeEl[]) => els.forEach((e) => (out.push(e), walk(e.children)));
    walk(this.children);
    return out;
  }
  querySelector(tag: string) {
    return this.all().find((e) => e.tag === tag) ?? null;
  }
  querySelectorAll() {
    return this.all();
  }
}

class FakeFrame {
  win = new FakeFrameWindow();
  contentDocument: unknown = null;
  srcs: string[] = [];
  listenerCountAtSrc: number[] = [];
  private loads = new Set<() => void>();
  constructor(private host: FakeHost) {}
  get contentWindow() {
    return this.win;
  }
  get src() {
    return this.srcs[this.srcs.length - 1] ?? '';
  }
  set src(v: string) {
    this.listenerCountAtSrc.push(this.host.listeners.size);
    this.srcs.push(v);
  }
  addEventListener(_t: 'load', l: () => void) {
    this.loads.add(l);
  }
  removeEventListener(_t: 'load', l: () => void) {
    this.loads.delete(l);
  }
  fireLoad() {
    for (const l of [...this.loads]) l();
  }
  get loadListeners() {
    return this.loads.size;
  }
}

const CATALOG = {
  tabs: [
    { id: 'overview', label: 'מרכז' },
    { id: 'users', label: 'אנשים' },
    { id: 'tools', label: 'ניהול' },
  ],
  tools: [
    { id: 'media_options', label: 'וידאו ושמע' },
    { id: 'schedules', label: 'לוחות זמנים' },
  ],
};
const ready = (extra: Record<string, unknown> = {}) => ({ type: 'wiskey:ready', version: 1, ...CATALOG, ...extra });

function setup(options: WiskeyConnectorOptions = {}) {
  const host = new FakeHost();
  const frame = new FakeFrame(host);
  const calls: { kind: string; value?: unknown }[] = [];
  const connector = attachWiskey(frame as unknown as WiskeyFrame, {
    onReady: (c) => calls.push({ kind: 'ready', value: c }),
    onLocation: (l) => calls.push({ kind: 'location', value: l }),
    onTitle: (t) => calls.push({ kind: 'title', value: t }),
    onLegacy: () => calls.push({ kind: 'legacy' }),
    onWaiting: () => calls.push({ kind: 'waiting' }),
    onUnsupported: (v) => calls.push({ kind: 'unsupported', value: v }),
    onRemount: () => calls.push({ kind: 'remount' }),
    ...options,
  }, host);
  const fromPanel = (data: unknown) => host.deliver(data, { source: frame.win });
  const kinds = () => calls.map((c) => c.kind);
  return { host, frame, calls, connector, fromPanel, kinds };
}

test('the panel URL is built from the origin, with embed=1 and chrome=none and the initial tab/tool, after the listener is registered', () => {
  const { frame } = setup({ initial: { tab: 'tools', tool: 'media_options' } });
  expect(frame.srcs).toEqual([`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=tools&tool=media_options`]);
  expect(frame.listenerCountAtSrc).toEqual([1]); // the message listener was in place before the src was assigned
  expect(frame.loadListeners).toBe(1);
  expect(setup().frame.src).toBe(`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=overview`);
  expect(wiskeyPanelUrl(ORIGIN, { tab: 'users' }, false)).toBe(`${ORIGIN}/hikvision-intercom?tab=users`);
  expect(wiskeyPanelUrl(ORIGIN, { tab: 'users', tool: null })).toBe(`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=users`);
});

test('only same-origin messages from the frame itself count', () => {
  const { host, frame, kinds, fromPanel } = setup();
  host.deliver(ready(), { origin: 'http://evil.test', source: frame.win }); // wrong origin
  host.deliver(ready(), { source: {} }); // right origin, another window (a sibling frame, the page itself)
  host.deliver(ready(), { source: null });
  expect(kinds()).toEqual([]);
  fromPanel(ready());
  expect(kinds()).toEqual(['ready']);
});

test('ready: version 1 only, a validated catalog that keeps ids and labels and nothing else, once per mounting', () => {
  const { calls, connector, fromPanel, frame, kinds } = setup();
  fromPanel('wiskey:ready'); // a string, not a structured message
  fromPanel(ready({ tabs: [{ id: 'users' }] })); // a label missing
  fromPanel(ready({ tools: 'media_options' }));
  fromPanel(ready({ tabs: [{ id: 3, label: 'x' }] }));
  expect(kinds()).toEqual([]);
  fromPanel(ready({ tabs: [{ id: 'users', label: 'אנשים', token: 'secret', person: { pin: '1234' } }], tools: [], extra: 'x' }));
  expect(kinds()).toEqual(['ready']);
  expect(calls[0].value).toEqual({ tabs: [{ id: 'users', label: 'אנשים' }], tools: [] });
  expect(connector.catalog).toEqual({ tabs: [{ id: 'users', label: 'אנשים' }], tools: [] });
  // a second ready (a remount the host did not ask for) is ignored until a deliberate refresh
  fromPanel(ready());
  expect(kinds()).toEqual(['ready']);
  connector.refresh();
  expect(connector.catalog).toBeNull();
  expect(frame.srcs.length).toBe(2);
  fromPanel(ready());
  expect(kinds()).toEqual(['ready', 'ready']);
  expect(connector.catalog?.tabs.map((t) => t.id)).toEqual(['overview', 'users', 'tools']);
});

test('any other version is unsupported, never assumed to be v1', () => {
  for (const version of [2, '1', 0, undefined, 1.5]) {
    const { calls, kinds, fromPanel, connector } = setup();
    fromPanel(ready({ version }));
    expect(kinds()).toEqual(['unsupported']);
    expect(calls[0].value).toBe(version);
    expect(connector.catalog).toBeNull();
    expect(connector.navigate({ tab: 'users' })).toBe(false);
  }
});

test('navigate waits for ready (queued), accepts catalog ids only and posts to the explicit same origin', () => {
  const { frame, connector, fromPanel } = setup();
  expect(connector.navigate({ tab: 'tools', tool: 'schedules' })).toBe(false); // queued
  expect(connector.navigate({ tab: 'users' })).toBe(false); // the latest request replaces the queued one
  expect(frame.win.posted).toEqual([]);
  fromPanel(ready());
  expect(frame.win.posted).toEqual([{ message: { type: 'wiskey:navigate', tab: 'users', tool: null }, target: ORIGIN }]);
  frame.win.posted = [];
  expect(connector.navigate({ tab: 'tools', tool: 'media_options' })).toBe(true);
  expect(connector.navigate({ tab: 'tools' })).toBe(true);
  expect(frame.win.posted.map((p) => p.message)).toEqual([
    { type: 'wiskey:navigate', tab: 'tools', tool: 'media_options' },
    { type: 'wiskey:navigate', tab: 'tools', tool: null },
  ]);
  expect(frame.win.posted.every((p) => p.target === ORIGIN)).toBe(true); // never '*'
  frame.win.posted = [];
  expect(connector.navigate({ tab: 'devices' })).toBe(false); // not in this user's catalog
  expect(connector.navigate({ tab: 'users', tool: 'media_options' })).toBe(false); // a tool only under tools
  expect(connector.navigate({ tab: 'tools', tool: 'whatsapp_templates' })).toBe(false); // a tool not listed
  expect(connector.navigate({ tab: 7 as unknown as string })).toBe(false);
  expect(connector.navigate({ tab: 'tools', tool: 5 as unknown as string })).toBe(false);
  expect(frame.win.posted).toEqual([]);
});

test('an unknown queued request is dropped at ready, not sent', () => {
  const { frame, connector, fromPanel } = setup();
  connector.navigate({ tab: 'camera_wall' });
  fromPanel(ready());
  expect(frame.win.posted).toEqual([]);
});

test('location is the confirmed location (also when the panel keeps the old one), and title is plain text - both only after ready', () => {
  const { calls, kinds, connector, fromPanel } = setup({ initial: { tab: 'tools', tool: 'schedules' } });
  fromPanel({ type: 'wiskey:location', tab: 'users', tool: null }); // before ready: ignored
  fromPanel({ type: 'wiskey:title', text: 'x' });
  expect(kinds()).toEqual([]);
  expect(connector.confirmed).toEqual({ tab: 'tools', tool: 'schedules' });
  fromPanel(ready());
  connector.navigate({ tab: 'users' });
  expect(connector.confirmed).toEqual({ tab: 'tools', tool: 'schedules' }); // nothing optimistic
  fromPanel({ type: 'wiskey:location', tab: 'tools', tool: 'schedules' }); // the user declined leaving unsaved edits
  expect(connector.confirmed).toEqual({ tab: 'tools', tool: 'schedules' });
  fromPanel({ type: 'wiskey:location', tab: 'users', tool: null });
  expect(connector.confirmed).toEqual({ tab: 'users', tool: null });
  fromPanel({ type: 'wiskey:location', tab: 'users' }); // tool missing (must be string or null)
  fromPanel({ type: 'wiskey:location', tab: 'users', tool: 3 });
  fromPanel({ type: 'wiskey:title', text: '<img src=x onerror=alert(1)>' });
  fromPanel({ type: 'wiskey:title', text: 42 });
  fromPanel({ type: 'wiskey:future-message', anything: true }); // an additive message type: ignored, not an error
  expect(calls.slice(1)).toEqual([
    { kind: 'location', value: { tab: 'tools', tool: 'schedules' } },
    { kind: 'location', value: { tab: 'users', tool: null } },
    { kind: 'title', value: '<img src=x onerror=alert(1)>' },
  ]);
});

test('refresh reopens the last confirmed tab/tool with embed=1 and chrome=none', () => {
  const { frame, connector, fromPanel } = setup({ initial: { tab: 'users', tool: null } });
  fromPanel(ready());
  fromPanel({ type: 'wiskey:location', tab: 'tools', tool: 'media_options' });
  connector.refresh();
  expect(frame.src).toBe(`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=tools&tool=media_options`);
});

test('12 s discovery: marker "1" without ready = waiting, no marker = legacy, another value = unsupported, no root = waiting', () => {
  const doc = (panel: FakeEl | null, nested = false) => {
    if (!panel) return new FakeRoot([new FakeEl('home-assistant')]);
    if (!nested) return new FakeRoot([new FakeEl('home-assistant'), panel]);
    const ha = new FakeEl('home-assistant');
    const main = new FakeEl('home-assistant-main');
    ha.shadowRoot = new FakeRoot([main]);
    main.shadowRoot = new FakeRoot([new FakeEl('ha-drawer'), panel]);
    return new FakeRoot([ha]);
  };
  const cases: [unknown, string, unknown?][] = [
    [doc(new FakeEl('hikvision-intercom-panel', { 'data-embed-api': '1' }), true), 'waiting'],
    [doc(new FakeEl('hikvision-intercom-panel'), true), 'legacy'],
    [doc(new FakeEl('hikvision-intercom-panel'), false), 'legacy'],
    [doc(new FakeEl('hikvision-intercom-panel', { 'data-embed-api': '2' }), true), 'unsupported', '2'],
    [doc(null), 'waiting'],
    [null, 'waiting'],
  ];
  for (const [document, expected, value] of cases) {
    const { host, frame, calls, kinds } = setup();
    frame.contentDocument = document;
    frame.fireLoad();
    host.advance(WISKEY_DISCOVERY_MS - 1);
    expect(kinds()).toEqual([]);
    host.advance(1);
    expect(kinds()).toEqual([expected]);
    if (value !== undefined) expect(calls[0].value).toBe(value);
  }
});

test('discovery: a frame on another origin is waiting (never legacy); a handshake before 12 s cancels discovery', () => {
  const a = setup();
  a.frame.contentDocument = new FakeRoot([new FakeEl('hikvision-intercom-panel')]);
  a.frame.win.location = { origin: 'http://elsewhere.test' };
  a.frame.fireLoad();
  a.host.advance(WISKEY_DISCOVERY_MS);
  expect(a.kinds()).toEqual(['waiting']);

  const b = setup();
  b.frame.contentDocument = new FakeRoot([new FakeEl('hikvision-intercom-panel')]); // would read as legacy
  b.frame.fireLoad();
  b.host.advance(5000);
  b.fromPanel(ready());
  b.host.advance(WISKEY_DISCOVERY_MS);
  expect(b.kinds()).toEqual(['ready']);
  b.host.advance(WISKEY_DISCOVERY_MS);
  expect(b.kinds()).toEqual(['ready']);
});

test('a new document after the handshake is a remount: the catalog is cleared and the next ready is accepted', () => {
  const { frame, connector, fromPanel, kinds } = setup();
  fromPanel(ready()); // the handshake may come before the load event of the same document
  frame.fireLoad();
  expect(kinds()).toEqual(['ready']); // the first load after src: not a remount
  expect(connector.catalog).not.toBeNull();
  frame.fireLoad(); // Home Assistant reloaded inside the frame (or a sign-in redirect)
  expect(kinds()).toEqual(['ready', 'remount']);
  expect(connector.catalog).toBeNull();
  expect(connector.navigate({ tab: 'users' })).toBe(false);
  fromPanel(ready());
  expect(kinds()).toEqual(['ready', 'remount', 'ready']);
  connector.refresh(); // a deliberate refresh resets the count: its first load is not a remount
  frame.fireLoad();
  expect(kinds()).toEqual(['ready', 'remount', 'ready']);
});

test('discovery is re-armed while no panel root is found, so a slow older build still reaches legacy (bounded)', () => {
  const a = setup();
  const root = new FakeRoot([new FakeEl('home-assistant')]);
  a.frame.contentDocument = root;
  a.frame.fireLoad();
  a.host.advance(WISKEY_DISCOVERY_MS);
  expect(a.kinds()).toEqual(['waiting']);
  a.host.advance(WISKEY_DISCOVERY_RETRY_MS);
  expect(a.kinds()).toEqual(['waiting', 'waiting']);
  root.children.push(new FakeEl('hikvision-intercom-panel')); // mounted at last, without a marker
  a.host.advance(WISKEY_DISCOVERY_RETRY_MS);
  expect(a.kinds()).toEqual(['waiting', 'waiting', 'legacy']);
  expect(a.host.pending).toBe(0);

  const b = setup();
  b.frame.contentDocument = new FakeRoot([new FakeEl('home-assistant')]);
  b.frame.fireLoad();
  b.host.advance(WISKEY_DISCOVERY_MS + WISKEY_DISCOVERY_RETRY_MS * (WISKEY_DISCOVERY_RETRIES + 5));
  expect(b.kinds().length).toBe(WISKEY_DISCOVERY_RETRIES + 1); // then it stops looking
  expect(b.kinds().every((k) => k === 'waiting')).toBe(true);
  expect(b.host.pending).toBe(0);
});

test('a ready of another version does not tear down a working v1 embed', () => {
  const { fromPanel, kinds, connector } = setup();
  fromPanel(ready());
  fromPanel(ready({ version: 2 }));
  expect(kinds()).toEqual(['ready']);
  expect(connector.catalog).not.toBeNull();
});

test('dispose detaches everything: no callbacks, no navigation, no timers', () => {
  const { host, frame, connector, fromPanel, kinds } = setup();
  frame.fireLoad();
  expect(host.pending).toBe(1);
  connector.dispose();
  expect(host.listeners.size).toBe(0);
  expect(frame.loadListeners).toBe(0);
  expect(host.pending).toBe(0);
  fromPanel(ready());
  expect(kinds()).toEqual([]);
  expect(connector.navigate({ tab: 'users' })).toBe(false);
  connector.refresh();
  expect(frame.srcs.length).toBe(1);
  expect(frame.win.posted).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// WisKey rc.37 (docs/integrations/wiskey/embed-api-v1/WISKEY_EMBED_API_V1.md §2): `chrome=none` (embed only) and the
// optional `density` / `wall` start choices. Which value is sent: the user's, else the installation's, else none.

test('chrome=none is sent only in embed mode; the normal deep link carries neither chrome, density nor wall', () => {
  expect(wiskeyPanelUrl(ORIGIN, { tab: 'overview' }, true)).toBe(`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=overview`);
  expect(wiskeyPanelUrl(ORIGIN, { tab: 'overview' }, false)).toBe(`${ORIGIN}/hikvision-intercom?tab=overview`);
  expect(wiskeyPanelUrl(ORIGIN, { tab: 'camera_wall' }, false, undefined, { density: '12', wall: '12' })).toBe(`${ORIGIN}/hikvision-intercom?tab=camera_wall`);
  expect(new URL(wiskeyPanelUrl(ORIGIN, { tab: 'tools', tool: 'health' }, false)).searchParams.has('chrome')).toBe(false);
});

test('the address keeps every existing parameter next to chrome=none, density and wall (extra params too)', () => {
  const url = new URL(wiskeyPanelUrl(ORIGIN, { tab: 'tools', tool: 'media_options' }, true, { external_auth: '1' }, { density: '8', wall: '9' }));
  expect(Object.fromEntries(url.searchParams)).toEqual({ embed: '1', chrome: 'none', tab: 'tools', tool: 'media_options', density: '8', wall: '9', external_auth: '1' });
  expect(url.origin + url.pathname).toBe(`${ORIGIN}/hikvision-intercom`);
  // the handoff's own examples
  expect(wiskeyPanelUrl(ORIGIN, { tab: 'camera_wall' }, true, undefined, { density: null, wall: '12' })).toBe(`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=camera_wall&wall=12`);
  expect(wiskeyPanelUrl(ORIGIN, { tab: 'overview' }, true, undefined, { density: '12', wall: null })).toBe(`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=overview&density=12`);
});

test('density accepts 4, 6, 8, 9, 12 and wall 4, 9, 12; anything else is left out of the address', () => {
  const search = (view: Record<string, unknown>) => new URL(wiskeyPanelUrl(ORIGIN, { tab: 'overview' }, true, undefined, view)).searchParams;
  for (const d of ['4', '6', '8', '9', '12']) expect(search({ density: d }).get('density')).toBe(d);
  for (const w of ['4', '9', '12']) expect(search({ wall: w }).get('wall')).toBe(w);
  for (const bad of ['', 'auto', '5', '10', '16', '012', '12 ', '12px', '-4', 'x', null, undefined, {}, [], true, 3, 0]) {
    const p = search({ density: bad, wall: bad });
    expect(p.has('density')).toBe(false);
    expect(p.has('wall')).toBe(false);
  }
  // 6 and 8 are overview counts, not wall budgets
  expect(search({ wall: '6' }).has('wall')).toBe(false);
  expect(search({ wall: '8' }).has('wall')).toBe(false);
  // a whole number is the same as its string
  expect(new URL(wiskeyPanelUrl(ORIGIN, { tab: 'overview' }, true, undefined, { density: 12, wall: 9 })).search).toBe('?embed=1&chrome=none&tab=overview&density=12&wall=9');
});

test('the parsers and the cleaner: only values WisKey accepts survive', () => {
  expect(parseWiskeyDensity('12')).toBe('12');
  expect(parseWiskeyDensity(6)).toBe('6');
  expect(parseWiskeyDensity('auto')).toBeNull();
  expect(parseWiskeyDensity(7)).toBeNull();
  expect(parseWiskeyWall('9')).toBe('9');
  expect(parseWiskeyWall(8)).toBeNull();
  expect(cleanWiskeyView({ density: '4', wall: 'x' })).toEqual({ density: '4', wall: null });
  expect(cleanWiskeyView(null)).toEqual({ density: null, wall: null });
  expect(sameWiskeyView({ density: '4', wall: null }, { density: '4', wall: null })).toBe(true);
  expect(sameWiskeyView({ density: '4', wall: null }, { density: '4', wall: '9' })).toBe(false);
});

test('precedence per parameter: the user, else the installation, else omitted', () => {
  // nothing anywhere: WisKey chooses
  expect(resolveWiskeyView({}, {})).toEqual({ density: null, wall: null });
  expect(resolveWiskeyView(null, undefined)).toEqual({ density: null, wall: null });
  expect(resolveWiskeyView({ density: null, wall: null }, { density: 'auto', wall: 'auto' })).toEqual({ density: null, wall: null });
  // the installation's default applies when the user chose nothing
  expect(resolveWiskeyView({}, { density: '9', wall: '12' })).toEqual({ density: '9', wall: '12' });
  expect(resolveWiskeyView({ density: null, wall: null }, { density: 9, wall: 12 })).toEqual({ density: '9', wall: '12' });
  // the user's own choice wins, each parameter on its own
  expect(resolveWiskeyView({ density: '4', wall: '9' }, { density: '12', wall: '12' })).toEqual({ density: '4', wall: '9' });
  expect(resolveWiskeyView({ density: '4' }, { density: '12', wall: '12' })).toEqual({ density: '4', wall: '12' });
  expect(resolveWiskeyView({ wall: '9' }, { density: '12', wall: '12' })).toEqual({ density: '12', wall: '9' });
  // the user's explicit "אוטומטי" leaves the density out even when the installation set one
  expect(resolveWiskeyView({ density: 'auto' }, { density: '12', wall: '12' })).toEqual({ density: null, wall: '12' });
  // an invalid value is ignored (WisKey ignores it too): it falls through to the next layer
  expect(resolveWiskeyView({ density: '7', wall: '6' }, { density: '8', wall: '4' })).toEqual({ density: '8', wall: '4' });
  expect(resolveWiskeyView({ density: '7', wall: '6' }, { density: '13', wall: 'auto' })).toEqual({ density: null, wall: null });
  expect(resolveWiskeyView({ density: 'wide' }, { density: 'auto' })).toEqual({ density: null, wall: null });
});

test('the connector puts the view on the first address and asks again on every refresh (a reload carries the newest choice)', () => {
  let view: { density: string | null; wall: string | null } = { density: '6', wall: null };
  const { frame, connector, fromPanel } = setup({ initial: { tab: 'overview', tool: null }, view: () => view });
  expect(frame.srcs).toEqual([`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=overview&density=6`]);
  fromPanel(ready());
  fromPanel({ type: 'wiskey:location', tab: 'users', tool: null });
  view = { density: '12', wall: '9' };
  connector.refresh();
  expect(frame.src).toBe(`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=users&density=12&wall=9`);
  view = { density: null, wall: null };
  connector.refresh();
  expect(frame.src).toBe(`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=users`);
});

test('a fixed view (no function) and an unusable view are both fine', () => {
  expect(setup({ view: { density: '4', wall: '12' } }).frame.src).toBe(`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=overview&density=4&wall=12`);
  expect(setup({ view: { density: 'huge' as never, wall: '5' as never } }).frame.src).toBe(`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=overview`);
  expect(setup({ view: () => ({ density: '9', wall: null }), extraParams: { external_auth: '1' } }).frame.src).toBe(`${ORIGIN}/hikvision-intercom?embed=1&chrome=none&tab=overview&density=9&external_auth=1`);
});
