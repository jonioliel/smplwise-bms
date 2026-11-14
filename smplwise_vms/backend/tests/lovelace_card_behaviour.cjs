'use strict';
/*
 * Behaviour test for the Lovelace card (smplwise_vms/integration/smplwise_bridge/www/smplwise-card.js), run by
 * tests/test_lovelace_card.py::test_card_behaviour_in_node with plain Node (no browser, no npm dependency).
 *
 * The card is loaded as is into a minimal fake DOM (HTMLElement, shadow root, customElements, document.cookie,
 * interval timers) with a fake hass whose callWS answers like Home Assistant's supervisor/api websocket command.
 * Usage: node lovelace_card_behaviour.cjs [path/to/smplwise-card.js]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CARD = process.argv[2] || path.resolve(__dirname, '..', '..', 'integration', 'smplwise_bridge', 'www', 'smplwise-card.js');

// ---- minimal DOM -------------------------------------------------------------------------------------------------
function parseAttrs(text) {
  const attrs = {};
  for (const m of text.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[m[1]] = m[2] === undefined ? '' : m[2];
  return attrs;
}

class FakeElement extends EventTarget {
  constructor(tag, attrs) {
    super();
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.dataset = {};
    for (const [k, v] of Object.entries(attrs)) if (k.startsWith('data-')) this.dataset[k.slice(5)] = v;
    this.value = '';
    this.hidden = false;
  }
}

class FakeShadowRoot {
  constructor() {
    this._html = '';
    this._els = [];
    this.activeElement = null;
  }
  set innerHTML(html) {
    this._html = html;
    this._els = [...html.matchAll(/<(select|input|label|iframe|div)\b([^>]*)>/g)].map((m) => new FakeElement(m[1], parseAttrs(m[2])));
  }
  get innerHTML() {
    return this._html;
  }
  querySelectorAll(selector) {
    const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (!m) throw new Error(`fake DOM: unsupported selector ${selector}`);
    return this._els.filter((e) => (m[2] === undefined ? m[1] in e.attrs : e.attrs[m[1]] === m[2]));
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

class HTMLElement extends EventTarget {
  attachShadow() {
    this.shadowRoot = new FakeShadowRoot();
    return this.shadowRoot;
  }
  get isConnected() {
    return Boolean(this._connected);
  }
}

const registry = new Map();
const intervals = new Map();
let nextInterval = 1;
const cookies = [];

globalThis.window = globalThis;
globalThis.HTMLElement = HTMLElement;
globalThis.customElements = {
  define: (name, ctor) => registry.set(name, ctor),
  get: (name) => registry.get(name),
};
globalThis.document = {
  createElement: (tag) => {
    const Ctor = registry.get(tag);
    if (!Ctor) throw new Error(`fake DOM: unknown element ${tag}`);
    return new Ctor();
  },
  set cookie(value) {
    cookies.push(value);
  },
  get cookie() {
    return cookies.join('; ');
  },
};
Object.defineProperty(globalThis, 'location', { value: { protocol: 'https:' }, configurable: true });
globalThis.setInterval = (fn, ms) => {
  const id = nextInterval++;
  intervals.set(id, { fn, ms });
  return id;
};
globalThis.clearInterval = (id) => intervals.delete(id);

function attach(el) {
  el._connected = true;
  if (el.connectedCallback) el.connectedCallback();
}
function detach(el) {
  el._connected = false;
  if (el.disconnectedCallback) el.disconnectedCallback();
}
async function settle() {
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
}
function unescapeHtml(s) {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (_m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]);
}

vm.runInThisContext(fs.readFileSync(CARD, 'utf8'), { filename: CARD });

// ---- fake hass ---------------------------------------------------------------------------------------------------
function makeHass({ panels = {}, ws = {} } = {}) {
  const calls = [];
  return {
    calls,
    panels,
    ws,
    callApi: () => Promise.reject(new Error('the card must not use the REST proxy')),
    callWS: (msg) => {
      if (msg.type !== 'supervisor/api') return Promise.reject({ code: 'invalid_format', message: msg.type });
      calls.push(`${msg.method} ${msg.endpoint}`);
      const handler = ws[msg.endpoint];
      if (!handler) return Promise.reject({ code: 'unknown_error', message: `no fake for ${msg.endpoint}` });
      return Promise.resolve().then(() => handler(msg));
    },
  };
}
const ok = (value) => () => value;
const fail = (value) => () => Promise.reject(value);

async function mount(config, hass) {
  const el = document.createElement('smplwise-card');
  el.setConfig({ type: 'custom:smplwise-card', ...config });
  el.hass = hass;
  attach(el);
  await settle();
  return el;
}
function shown(el) {
  const html = el.shadowRoot.innerHTML;
  const src = /<iframe src="([^"]*)"/.exec(html);
  const msg = /<div class="msg">([\s\S]*?)<\/div>/.exec(html);
  const height = /block-size:(\d+)px/.exec(html);
  return {
    phase: el._state && el._state.phase,
    src: src ? unescapeHtml(src[1]) : null,
    text: msg ? unescapeHtml(msg[1].replace(/<[^>]+>/g, '')) : null,
    height: height ? Number(height[1]) : null,
    html,
  };
}

// ---- tests -------------------------------------------------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function expect(cond, detail) {
  if (!cond) throw new Error(detail || 'expectation failed');
}

const PANEL_NEW = { '1a2b3c4d_smplwise_vms': { url_path: '1a2b3c4d_smplwise_vms', component_name: 'app', config: { addon: '1a2b3c4d_smplwise_vms' } } };
const PANEL_OLD = { deadbeef_smplwise_vms: { url_path: 'deadbeef_smplwise_vms', component_name: 'custom', config: { _panel_custom: { name: 'hassio-main' }, ingress: 'deadbeef_smplwise_vms' } } };
const info = (url) => ok({ ingress_url: url });

test('panel config.addon (current HA) is found without the admin-only list', async () => {
  const hass = makeHass({ panels: { lovelace: { url_path: 'lovelace', config: { mode: 'storage' } }, ...PANEL_NEW }, ws: { '/addons/1a2b3c4d_smplwise_vms/info': info('/api/hassio_ingress/a/'), '/ingress/session': ok({ session: 's1' }), '/addons': fail({ code: 'x', message: 'must not be called' }) } });
  const v = shown(await mount({ view: 'events' }, hass));
  expect(v.phase === 'ready' && v.src === '/api/hassio_ingress/a/#/investigate/events?embed=1', JSON.stringify(v));
  expect(hass.calls.join(',') === 'get /addons/1a2b3c4d_smplwise_vms/info,post /ingress/session', hass.calls.join(','));
  expect(cookies[cookies.length - 1].startsWith('ingress_session=s1; path=/api/hassio_ingress/; SameSite=Strict; Secure'), cookies[cookies.length - 1]);
});

test('panel config.ingress (older HA) is found, map route encodes the floor', async () => {
  const hass = makeHass({ panels: PANEL_OLD, ws: { '/addons/deadbeef_smplwise_vms/info': info('/api/hassio_ingress/b/'), '/ingress/session': ok({ session: 's' }) } });
  const v = shown(await mount({ view: 'map', floor: 'f 1' }, hass));
  expect(v.src === '/api/hassio_ingress/b/#/explore/floors/f%201?embed=1', JSON.stringify(v));
});

test('admin add-on list: hashed and local slugs, addons or apps key, foreign slugs ignored', async () => {
  for (const key of ['addons', 'apps']) {
    const hass = makeHass({ ws: { '/addons': ok({ [key]: [{ slug: 'core_ssh' }, { slug: 'smplwise_vms_extra' }, { slug: 'local_smplwise_vms' }] }), '/addons/local_smplwise_vms/info': info('/api/hassio_ingress/c/'), '/ingress/session': ok({ session: 's' }) } });
    const v = shown(await mount({ view: 'camera', camera: 'cam7' }, hass));
    expect(v.src === '/api/hassio_ingress/c/#/live/cameras/cam7?embed=1', `${key}: ${JSON.stringify(v)}`);
  }
});

test('discovery order: ingress_url, then addon, then the panel, then the list', async () => {
  let hass = makeHass({ panels: PANEL_NEW, ws: { '/ingress/session': ok({ session: 's' }) } });
  let v = shown(await mount({ ingress_url: '/api/hassio_ingress/manual/', addon: 'zz_smplwise_vms' }, hass));
  expect(v.src === '/api/hassio_ingress/manual/#/investigate/events?embed=1' && hass.calls.join(',') === 'post /ingress/session', hass.calls.join(','));
  hass = makeHass({ panels: PANEL_NEW, ws: { '/addons/zz_smplwise_vms/info': info('/api/hassio_ingress/z/'), '/ingress/session': ok({ session: 's' }) } });
  v = shown(await mount({ addon: 'zz_smplwise_vms' }, hass));
  expect(v.src.startsWith('/api/hassio_ingress/z/') && hass.calls[0] === 'get /addons/zz_smplwise_vms/info', hass.calls.join(','));
});

test('every rejection shape becomes readable text, never [object Object]', async () => {
  const cases = [
    [{ code: 'unauthorized', message: 'Unauthorized' }, 'unauthorized: Unauthorized'], // callWS
    [{ error: 'Response error: 400', status_code: 400, body: { result: 'error', message: 'App is not installed' } }, 'Response error: 400 - App is not installed'], // callApi, Supervisor body
    [{ error: 'Response error: 401', status_code: 401, body: '401: Unauthorized' }, 'Response error: 401 - 401: Unauthorized'], // callApi, text body
    [{ error: 'Request error', status_code: undefined, body: undefined }, 'Request error'],
    [{ type: 'result', success: false, error: { code: 3, message: 'Connection lost' } }, '3: Connection lost'], // js-websocket connection lost
    [3, '3'],
    [undefined, 'unknown error'],
    [{}, 'unknown error'],
    [new Error('boom'), 'boom'],
  ];
  for (const [rejection, expected] of cases) {
    const hass = makeHass({ ws: { '/addons/x_smplwise_vms/info': fail(rejection) } });
    const v = shown(await mount({ addon: 'x_smplwise_vms' }, hass));
    expect(v.phase === 'error' && v.text.includes(`: ${expected})`) && !v.text.includes('[object Object]'), `${JSON.stringify(rejection)} -> ${v.text}`);
    expect(v.text.includes('ingress_url') && v.text.includes('addon'), 'the two manual overrides are suggested');
  }
});

test('non-admin without the sidebar panel, and a missing add-on, get clear messages', async () => {
  let v = shown(await mount({}, makeHass({ ws: { '/addons': fail({ code: 'unauthorized', message: 'Unauthorized' }) } })));
  expect(v.phase === 'error' && v.text.includes('unauthorized: Unauthorized') && v.text.includes('למנהלי Home Assistant'), v.text);
  v = shown(await mount({}, makeHass({ ws: { '/addons': ok({ addons: [{ slug: 'core_ssh' }] }) } })));
  expect(v.phase === 'error' && v.text.includes('לא נמצא בין התוספים המותקנים'), v.text);
});

test('server text and the title are escaped before innerHTML', async () => {
  const hass = makeHass({ ws: { '/ingress/session': fail({ code: 'x', message: '<img src=x onerror=alert(1)>' }) } });
  const el = await mount({ ingress_url: '/api/hassio_ingress/m', title: '<b>t</b>' }, hass);
  const v = shown(el);
  expect(!v.html.includes('<img') && v.html.includes('&lt;img') && v.html.includes('&lt;b&gt;t&lt;/b&gt;'), v.html);
});

test('a config change re-routes the iframe, a height below the minimum is clamped', async () => {
  const hass = makeHass({ panels: PANEL_NEW, ws: { '/addons/1a2b3c4d_smplwise_vms/info': info('/api/hassio_ingress/q/'), '/ingress/session': ok({ session: 's' }) } });
  const el = await mount({ view: 'events' }, hass);
  const before = hass.calls.length;
  el.setConfig({ type: 'custom:smplwise-card', view: 'health', height: 1 });
  const v = shown(el);
  expect(v.src === '/api/hassio_ingress/q/#/system?embed=1' && v.height === 100 && hass.calls.length === before, JSON.stringify({ v, calls: hass.calls }));
  let threw = false;
  try {
    el.setConfig({ view: 'nope' });
  } catch (_e) {
    threw = true;
  }
  expect(threw, 'an unknown view is rejected');
});

test('visual editor: fields, visibility per view, config-changed events', async () => {
  const Card = customElements.get('smplwise-card');
  const ed = Card.getConfigElement();
  expect(ed.constructor === customElements.get('smplwise-card-editor'), 'getConfigElement returns smplwise-card-editor');
  expect(JSON.stringify(Card.getStubConfig()) === JSON.stringify({ view: 'events', height: 360 }), 'stub config');
  const events = [];
  ed.addEventListener('config-changed', (e) => events.push(e));
  ed.setConfig({ type: 'custom:smplwise-card', view: 'camera', camera: 'c1', height: 300, title: 'T' });
  const q = (s) => ed.shadowRoot.querySelector(s);
  const options = [...ed.shadowRoot.innerHTML.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  expect(options.join(',') === 'camera,map,events,health,wall', options.join(','));
  expect(q('[data-key="view"]').value === 'camera' && q('[data-key="camera"]').value === 'c1' && q('[data-key="height"]').value === '300' && q('[data-key="title"]').value === 'T', 'initial values');
  expect(q('[data-for="camera"]').hidden === false && q('[data-for="map"]').hidden === true, 'camera shown only for view camera');
  const set = (key, value, type) => {
    const el = q(`[data-key="${key}"]`);
    el.value = value;
    el.dispatchEvent(new Event(type));
  };
  set('view', 'map', 'change');
  expect(q('[data-for="camera"]').hidden === true && q('[data-for="map"]').hidden === false, 'floor shown only for view map');
  set('floor', 'F2', 'input');
  set('height', '420', 'input');
  set('title', '', 'input');
  set('height', '5', 'input');
  expect(events.length === 5 && events.every((e) => e.bubbles && e.composed && e.type === 'config-changed'), `events ${events.length}`);
  const last = events[events.length - 1].detail.config;
  expect(last.type === 'custom:smplwise-card' && last.view === 'map' && last.floor === 'F2' && last.height === 100 && !('title' in last), JSON.stringify(last));
  expect(events[2].detail.config.height === 420, 'height is a number');
  // Lovelace echoes the config back: the editor keeps the values
  ed.setConfig(last);
  expect(q('[data-key="view"]').value === 'map' && q('[data-key="floor"]').value === 'F2', 'echoed config');
});

test('re-attach: a still valid session keeps running, an expired one is replaced (S1)', async () => {
  let n = 0;
  const hass = makeHass({ panels: PANEL_NEW, ws: { '/addons/1a2b3c4d_smplwise_vms/info': info('/api/hassio_ingress/r/'), '/ingress/session': () => ({ session: `r${++n}` }), '/ingress/validate_session': ok({}) } });
  const el = await mount({ view: 'events' }, hass);
  expect(el._session === 'r1' && el._timer && intervals.has(el._timer), 'keep-alive started');
  const running = el._timer;
  detach(el);
  expect(!el._timer && !intervals.has(running), 'keep-alive stopped while detached');
  attach(el);
  await settle();
  expect(el._session === 'r1' && el._timer && intervals.has(el._timer), 'valid session kept, keep-alive restarted');
  expect(hass.calls.filter((c) => c === 'post /ingress/validate_session').length === 1, hass.calls.join(','));
  detach(el);
  hass.ws['/ingress/validate_session'] = fail({ code: 'unknown_error', message: 'Session is not valid' });
  attach(el);
  await settle();
  const v = shown(el);
  expect(el._session === 'r2' && v.phase === 'ready' && v.src === '/api/hassio_ingress/r/#/investigate/events?embed=1', JSON.stringify({ s: el._session, v }));
  expect(cookies[cookies.length - 1].startsWith('ingress_session=r2;'), cookies[cookies.length - 1]);
  detach(el);
});

test('keep-alive failure on screen takes a fresh session without reloading the iframe', async () => {
  let n = 0;
  const hass = makeHass({ panels: PANEL_NEW, ws: { '/addons/1a2b3c4d_smplwise_vms/info': info('/api/hassio_ingress/k/'), '/ingress/session': () => ({ session: `k${++n}` }), '/ingress/validate_session': ok({}) } });
  const el = await mount({ view: 'events' }, hass);
  const html = el.shadowRoot.innerHTML;
  const timer = intervals.get(el._timer);
  expect(timer && timer.ms === 4 * 60 * 1000, 'validates every four minutes');
  hass.ws['/ingress/validate_session'] = fail({ code: 'unknown_error', message: 'Session is not valid' });
  timer.fn();
  await settle();
  expect(el._session === 'k2' && cookies[cookies.length - 1].startsWith('ingress_session=k2;'), el._session);
  expect(el.shadowRoot.innerHTML === html, 'the iframe is not re-rendered');
  hass.ws['/ingress/session'] = fail({ code: 'unknown_error', message: 'down' });
  hass.ws['/ingress/validate_session'] = fail({ code: 'unknown_error', message: 'down' });
  intervals.get(el._timer).fn();
  await settle();
  expect(el._session === 'k2' && intervals.has(el._timer) && shown(el).phase === 'ready', 'a failed renewal keeps the card and retries on the next tick');
  detach(el);
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (err) {
      failed += 1;
      console.log(`FAIL ${name}\n     ${err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n     ') : err}`);
    }
  }
  console.log(`${tests.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
