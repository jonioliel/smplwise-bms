import { test, expect } from '@playwright/test';
import { attachWiskey, wiskeyPanelUrl, WISKEY_DISCOVERY_MS, type WiskeyConnectorOptions, type WiskeyFrame, type WiskeyHost } from '../src/wiskey/embed-connector';

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
    this.now += ms;
    for (const [id, t] of [...this.timers].sort((a, b) => a[1].at - b[1].at)) {
      if (t.at > this.now) continue;
      this.timers.delete(id);
      t.fn();
    }
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
    ...options,
  }, host);
  const fromPanel = (data: unknown) => host.deliver(data, { source: frame.win });
  const kinds = () => calls.map((c) => c.kind);
  return { host, frame, calls, connector, fromPanel, kinds };
}

test('the panel URL is built from the origin, with embed=1 and the initial tab/tool, after the listener is registered', () => {
  const { frame } = setup({ initial: { tab: 'tools', tool: 'media_options' } });
  expect(frame.srcs).toEqual([`${ORIGIN}/hikvision-intercom?embed=1&tab=tools&tool=media_options`]);
  expect(frame.listenerCountAtSrc).toEqual([1]); // the message listener was in place before the src was assigned
  expect(frame.loadListeners).toBe(1);
  expect(setup().frame.src).toBe(`${ORIGIN}/hikvision-intercom?embed=1&tab=overview`);
  expect(wiskeyPanelUrl(ORIGIN, { tab: 'users' }, false)).toBe(`${ORIGIN}/hikvision-intercom?tab=users`);
  expect(wiskeyPanelUrl(ORIGIN, { tab: 'users', tool: null })).toBe(`${ORIGIN}/hikvision-intercom?embed=1&tab=users`);
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

test('refresh reopens the last confirmed tab/tool with embed=1', () => {
  const { frame, connector, fromPanel } = setup({ initial: { tab: 'users', tool: null } });
  fromPanel(ready());
  fromPanel({ type: 'wiskey:location', tab: 'tools', tool: 'media_options' });
  connector.refresh();
  expect(frame.src).toBe(`${ORIGIN}/hikvision-intercom?embed=1&tab=tools&tool=media_options`);
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
  b.frame.fireLoad(); // a later load with a catalog in hand starts no discovery
  b.host.advance(WISKEY_DISCOVERY_MS);
  expect(b.kinds()).toEqual(['ready']);
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
