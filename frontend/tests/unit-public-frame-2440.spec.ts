import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { h, icon } from '../src/public-ticket/dom';
import { bannerEl, centerScreen, codeCard, langPicker, messageContent, themeToggle, type FrameText } from '../src/public-ticket/page-frame';
import { LANG_SELF, LANGS, type Lang } from '../src/public-ticket/strings';
import type { ThemeChoice, ThemeMode } from '../src/public-ticket/theme';

// CR-PUBLIC-FRAME-2440 (review 08:F16; docs/changes/CR-PUBLIC-FRAME-2440.md): the frame the ticket page and the RFQ page share
// (public-ticket/page-frame.ts). Node only: a small stand-in document records what dom.ts `h` builds, and each builder is held to
// the lines the two pages carried before, written out once more below - the same elements, classes, attributes in the same order,
// text nodes and listeners.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src', 'public-ticket');

interface FakeNode {
  tag: string;
  className: string;
  attrs: [string, string][];
  listeners: Record<string, (e: unknown) => void>;
  children: (FakeNode | string)[];
  value?: string;
  setAttribute(k: string, v: string): void;
  addEventListener(ev: string, fn: (e: unknown) => void): void;
  appendChild(c: FakeNode | { text: string }): void;
}

function fakeNode(tag: string): FakeNode {
  return {
    tag,
    className: '',
    attrs: [],
    listeners: {},
    children: [],
    setAttribute(k, v) { this.attrs.push([k, v]); },
    addEventListener(ev, fn) { this.listeners[ev] = fn; },
    appendChild(c) { this.children.push('text' in c ? c.text : (c as FakeNode)); },
  };
}

/** Run `fn` with the stand-in document; the real global (none, in Node) is put back whatever happens. */
function withDom<T>(fn: () => T): T {
  const g = globalThis as { document?: unknown };
  const before = g.document;
  g.document = { createElement: fakeNode, createElementNS: (_ns: string, tag: string) => fakeNode(tag), createTextNode: (text: string) => ({ text }) };
  try {
    return fn();
  } finally {
    if (before === undefined) delete g.document;
    else g.document = before;
  }
}

/** What was built, as text: the tag, the class, every attribute in the order it was set, the listeners' names, the value, the children. */
function dump(n: FakeNode | string | null): string {
  if (n === null) return 'null';
  if (typeof n === 'string') return JSON.stringify(n);
  const attrs = n.attrs.map(([k, v]) => ` ${k}=${JSON.stringify(v)}`).join('');
  const on = Object.keys(n.listeners).length ? ` on:${Object.keys(n.listeners).join(',')}` : '';
  const value = n.value !== undefined ? ` value=${JSON.stringify(n.value)}` : '';
  return `<${n.tag}${n.className ? ` class=${JSON.stringify(n.className)}` : ''}${attrs}${on}${value}>${n.children.map(dump).join('')}</${n.tag}>`;
}
const D = (el: unknown): string => dump(el as FakeNode | null);

const t: FrameText = (key, vars) => `[${key}${vars ? `:${JSON.stringify(vars)}` : ''}]`;
const prefersDark = (): boolean => false; // Node: no matchMedia (theme.ts prefersDark answers false)

// ---------------------------------------------------------------- the lines both pages carried before this change

function oldThemeToggle(theme: ThemeMode): unknown {
  const dark = theme === 'dark' || (theme === 'auto' && prefersDark());
  return h('button', { class: 'icon-btn', attrs: { type: 'button', 'data-theme-toggle': dark ? 'dark' : 'light', 'aria-label': t(dark ? 'themeToLight' : 'themeToDark') },
    on: { click: () => undefined } }, icon(dark ? 'sun' : 'moon'));
}

function oldLangPicker(lang: Lang): unknown {
  const sel = h('select', { class: 'lang', attrs: { 'aria-label': t('language'), 'data-lang-picker': true }, on: { change: () => undefined } });
  for (const l of LANGS) {
    const o = h('option', { attrs: { value: l, selected: l === lang, lang: l } }, LANG_SELF[l].langName);
    sel.appendChild(o);
  }
  return sel;
}

function oldMessage(pageClass: string, head: HTMLElement | null, title: string, bodyKey: string, ic: string, retry: boolean): unknown {
  return h('div', { class: pageClass }, head, h('main', { class: 'center' }, h('section', { class: 'card msg' },
    h('div', { class: 'msg-icon' }, icon(ic)),
    h('h1', { class: 'msg-title', attrs: { 'data-state-title': title } }, t(title)),
    h('p', { class: 'msg-body' }, t(bodyKey)),
    retry ? h('button', { class: 'btn block', attrs: { type: 'button' }, on: { click: () => undefined } }, t('retry')) : null)));
}

function oldBanner(b: { key: string; tone: 'ok' | 'bad' | 'info'; n?: number } | null): unknown {
  if (!b) return null;
  return h('div', { class: `banner ${b.tone}`, attrs: { role: b.tone === 'bad' ? 'alert' : 'status', 'data-banner': b.key } }, t(b.key, { n: b.n ?? '' }));
}

function oldCodeCard(code: { sent: boolean; value: string; message: null | { key: string; n?: number } }, busy: boolean, sub: HTMLElement | null): unknown {
  const m = code.message;
  const input = h('input', { class: 'input code', attrs: { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 9, 'aria-label': t('codeInput'),
    'data-code-input': true, dir: 'ltr' }, on: { input: () => undefined } });
  input.value = code.value;
  return h('section', { class: 'card code' },
    h('div', { class: 'msg-icon' }, icon('lock')),
    h('h1', { class: 'msg-title' }, t('codeTitle')),
    h('p', { class: 'msg-body' }, t('codeBody')),
    sub,
    m ? h('div', { class: `banner ${m.key.startsWith('codeSent') ? 'ok' : 'bad'}`, attrs: { role: 'status', 'data-code-message': m.key } }, t(m.key, { n: m.n ?? '' })) : null,
    code.sent ? h('div', { class: 'row' }, input,
      h('button', { class: 'btn primary', attrs: { type: 'button', disabled: busy, 'data-code-verify': true }, on: { click: () => undefined } }, t('codeVerify'))) : null,
    h('button', { class: `btn ${code.sent ? 'ghost' : 'primary'} block`, attrs: { type: 'button', disabled: busy, 'data-code-send': true },
      on: { click: () => undefined } }, t(code.sent ? 'codeResend' : 'codeSend')));
}

// ---------------------------------------------------------------- the builders

test('the theme toggle: the same button for light, dark and auto; a press saves nothing but the opposite choice and hands it over', () => {
  withDom(() => {
    for (const theme of ['light', 'dark', 'auto'] as ThemeMode[]) expect(D(themeToggle(theme, t, () => undefined)), theme).toBe(D(oldThemeToggle(theme)));
    const got: ThemeChoice[] = [];
    (themeToggle('light', t, (c) => got.push(c)) as unknown as FakeNode).listeners.click({});
    (themeToggle('dark', t, (c) => got.push(c)) as unknown as FakeNode).listeners.click({});
    (themeToggle('auto', t, (c) => got.push(c)) as unknown as FakeNode).listeners.click({});
    expect(got).toEqual(['dark', 'light', 'dark']);
  });
});

test('the language picker: every language by its own name, the current one selected; only a language of the page is handed over', () => {
  withDom(() => {
    for (const lang of LANGS) expect(D(langPicker(lang, t, () => undefined)), lang).toBe(D(oldLangPicker(lang)));
    const picked: Lang[] = [];
    const sel = langPicker('he', t, (l) => picked.push(l)) as unknown as FakeNode;
    sel.listeners.change({ target: { value: 'en' } });
    sel.listeners.change({ target: { value: 'xx' } });
    sel.listeners.change({ target: { value: 'ru' } });
    expect(picked).toEqual(['en', 'ru']);
  });
});

test('the message screen: both pages\' class lists, with and without a header and a retry', () => {
  withDom(() => {
    for (const pageClass of ['page', 'page rfq']) {
      for (const withHead of [false, true]) {
        for (const retry of [false, true]) {
          const head = () => (withHead ? h('header', { class: 'top' }, 'x') : null);
          const now = centerScreen(pageClass, head(), messageContent(t, 'busyTitle', 'busyBody', 'clock', retry ? () => undefined : null));
          expect(D(now), `${pageClass} head=${withHead} retry=${retry}`).toBe(D(oldMessage(pageClass, head(), 'busyTitle', 'busyBody', 'clock', retry)));
        }
      }
    }
    let retried = 0;
    const content = messageContent(t, 'errorTitle', 'errorBody', 'clock', () => { retried += 1; });
    (content[3] as unknown as FakeNode).listeners.click({});
    expect(retried).toBe(1);
    expect(messageContent(t, 'finishedTitle', 'finishedBody', 'out', null)[3]).toBeNull();
    // the loading screen of both pages goes through the same builder
    expect(D(centerScreen('page', null, [h('div', { class: 'spinner', attrs: { role: 'status' } })]))).toBe('<div class="page"><main class="center"><section class="card msg"><div class="spinner" role="status"></div></section></main></div>');
  });
});

test('the banner: an alert only when it is bad, the count handed to the words, nothing when there is none', () => {
  withDom(() => {
    for (const b of [{ key: 'saved', tone: 'ok' as const }, { key: 'failed', tone: 'bad' as const, n: 3 }, { key: 'note', tone: 'info' as const, n: 0 }]) expect(D(bannerEl(b, t)), b.key).toBe(D(oldBanner(b)));
    expect(bannerEl(null, t)).toBeNull();
    expect(D(bannerEl({ key: 'failed', tone: 'bad' }, t))).toBe('<div class="banner bad" role="alert" data-banner="failed">"[failed:{\\"n\\":\\"\\"}]"</div>');
  });
});

test('the code card: before and after a code was sent, busy or not, with each page\'s own line, with each kind of message', () => {
  withDom(() => {
    const subs: (() => HTMLElement | null)[] = [
      () => null,
      () => h('p', { class: 'msg-sub' }, 'מספר 12 · אחזקה'), // the ticket page's line
      () => h('p', { class: 'msg-sub' }, h('span', { attrs: { dir: 'ltr' } }, 'RFQ-7'), ' · אחזקה'), // the RFQ page's line
    ];
    const messages = [null, { key: 'codeSent', n: 10 }, { key: 'codeSentWa', n: 5 }, { key: 'codeWrong' }, { key: 'codeLocked', n: 2 }];
    for (const sub of subs) {
      for (const sent of [false, true]) {
        for (const busy of [false, true]) {
          for (const message of messages) {
            const code = { sent, value: sent ? '123456' : '', message };
            const now = codeCard({ t, code, busy, sub: sub(), onSend: () => undefined, onVerify: () => undefined });
            expect(D(now), JSON.stringify({ sent, busy, message })).toBe(D(oldCodeCard(code, busy, sub())));
          }
        }
      }
    }
  });
});

test('the code card writes each keystroke into the page\'s code state and calls the page for send and verify', () => {
  withDom(() => {
    const code = { sent: true, value: '12', message: null };
    const calls: string[] = [];
    const card = codeCard({ t, code, busy: false, sub: null, onSend: () => calls.push('send'), onVerify: () => calls.push('verify') }) as unknown as FakeNode;
    const row = card.children.find((c) => typeof c !== 'string' && c.className === 'row') as FakeNode;
    const input = row.children[0] as FakeNode;
    expect(input.value).toBe('12');
    input.listeners.input({ target: { value: '1234' } });
    expect(code.value).toBe('1234');
    (row.children[1] as FakeNode).listeners.click({});
    (card.children[card.children.length - 1] as FakeNode).listeners.click({});
    expect(calls).toEqual(['verify', 'send']);
  });
});

// ---------------------------------------------------------------- the two pages

const read = (rel: string): string => readFileSync(path.join(SRC, rel), 'utf8');

test('both pages build the frame through page-frame.ts and carry none of its lines any more', () => {
  for (const [file, from] of [['main.ts', './page-frame'], ['rfq/rfq-page.ts', '../page-frame']] as const) {
    const src = read(file);
    expect(src, file).toContain(`import { bannerEl, centerScreen, codeCard, langPicker, messageContent, themeToggle } from '${from}';`);
    for (const gone of ["'data-theme-toggle'", "'data-lang-picker'", "'data-state-title'", "'data-banner'", "'data-code-input'", "'data-code-verify'", "'data-code-send'", "class: 'card msg'", 'nextChoice(', 'LANG_SELF']) {
      expect(src, `${file}: ${gone}`).not.toContain(gone);
    }
  }
  // each page keeps what is its own: its language handling, its code line, its page class
  expect(read('main.ts')).toContain('langPicker(this.lang, this.frameText, (lang) => this.setLang(lang))');
  expect(read('rfq/rfq-page.ts')).toContain("this.host.chosenLang = value; this.host.store('lang', value);");
  expect(read('rfq/rfq-page.ts')).toContain("centerScreen('page rfq',");
  expect(read('main.ts')).toContain("centerScreen('page',");
});

test('the frame module keeps the public bundle\'s rules: text nodes only, no link, no storage of its own, nothing from the app', () => {
  const src = read('page-frame.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  expect(src).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|unsafeHTML|new Function|eval\(/);
  expect(src).not.toMatch(/\bstyle\s*[:=]|\.style\b|cssText/); // no inline style
  expect(src).not.toMatch(/createElement\(['"]a['"]\)|h\(['"]a['"]|\.href\s*=/);
  expect(src).not.toMatch(/localStorage|sessionStorage|document\.cookie|serviceWorker/);
  expect([...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort()).toEqual(['./dom', './strings', './theme']);
  // the RFQ chunk reaches the frame through the entry chunk's module: the ticket page still never imports the RFQ folder
  expect(read('main.ts')).not.toMatch(/from '\.\/rfq\//);
});
