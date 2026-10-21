/**
 * CR-VENDORQ-294: the document page - a lazy chunk (`doc-page-*`), fetched only for a `#d.<token>` link (main.ts). One card: the
 * organisation's name and logo, the file's name, size, expiry and downloads left, one download button. Nothing personal is shown (the
 * server sends no recipient). The token stays in memory only (never in storage, never in the address bar - main.ts already replaced it)
 * and travels in the `X-Ticket-Token` header; no cookie (`credentials: 'omit'`), nothing cached, a redirect is an error.
 *
 * The download: the bytes come from `GET /t/api/doc/file` (each download counts on the server) and are handed to the browser as a
 * `blob:` object URL of THIS page with the server's own `[A-Za-z0-9._-]` file name - the only link this chunk ever builds; it is revoked
 * right after the click. An unknown, expired, revoked or used-up link is the page's own "unavailable" screen (the uniform 404).
 */
import cssUrl from '../consent/consent-page.css?url';
import { withBase } from '../base';
import { brandMark } from '../brand';
import { h } from '../dom';
import { LANG_SELF, isLang, LANGS, RTL, type Lang } from '../strings';
import { applyMode, resolveMode, saveServerMode, storedChoice } from '../theme';
import { dt, safeName, sizeText, type DocKey } from './doc-text';

export interface DocHost {
  root: HTMLElement;
  token: string;
  lang: Lang;
  setLang(lang: Lang): void;
  unavailable(): void;
}

interface Meta { filename: string; media_type: string; size: number; expires_at: string; opens_left: number; organization?: string; logo?: string | null;
  theme?: 'light' | 'dark' | 'auto' }

function req(token: string, route: string): Promise<Response | null> {
  return fetch(withBase(route), { method: 'GET', headers: { 'X-Ticket-Token': token }, credentials: 'omit', cache: 'no-store', redirect: 'error',
    referrerPolicy: 'no-referrer' }).catch(() => null);
}

/** What an answer means for the page (pure; checked as source by the unit spec). */
export function outcomeOf(status: number): 'ok' | 'unavailable' | DocKey {
  if (status === 200) return 'ok';
  if (status === 404) return 'unavailable';
  if (status === 429) return 'rateLimited';
  if (status === 0) return 'offline';
  return 'error';
}

class DocPage {
  private lang: Lang;
  private meta: Meta | null = null;
  private busy = false;
  private done = false;
  private message: DocKey | null = null;

  constructor(private host: DocHost) {
    this.lang = host.lang;
  }

  async start(): Promise<void> {
    if (!document.querySelector('link[data-consent-css]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.setAttribute('href', cssUrl); // a file of this page's own origin (CSP style-src 'self')
      css.setAttribute('data-consent-css', '');
      document.head.appendChild(css);
    }
    const res = await req(this.host.token, '/t/api/doc');
    const next = outcomeOf(res ? res.status : 0);
    if (next === 'unavailable' || (next === 'error' && res)) {
      this.host.unavailable();
      return;
    }
    if (next !== 'ok' || !res) {
      this.message = next === 'ok' ? 'error' : next;
      this.render();
      return;
    }
    try {
      this.meta = (await res.json()) as Meta;
    } catch {
      this.host.unavailable();
      return;
    }
    if (this.meta.theme) saveServerMode(this.meta.theme);
    applyMode(resolveMode(storedChoice(), this.meta.theme ?? null));
    this.render();
  }

  private async download(): Promise<void> {
    if (this.busy || !this.meta) return;
    this.busy = true;
    this.message = null;
    this.render();
    const res = await req(this.host.token, '/t/api/doc/file');
    const next = outcomeOf(res ? res.status : 0);
    this.busy = false;
    if (next === 'unavailable') {
      this.message = 'usedUp';
      this.meta = { ...this.meta, opens_left: 0 };
      this.render();
      return;
    }
    if (next !== 'ok' || !res) {
      this.message = next === 'ok' ? 'error' : next;
      this.render();
      return;
    }
    // FABLEFIX-295 D-02: the bytes become an opaque download whatever type the answer carried - a blob that a WebView ignoring
    // `download` navigates to is never rendered as HTML on this page's origin
    const blob = await res
      .arrayBuffer()
      .then((buf) => new Blob([buf], { type: 'application/octet-stream' }))
      .catch(() => null);
    if (!blob) {
      this.message = 'error';
      this.render();
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url); // a blob: URL of this page - never an address the server or a message gave
    a.setAttribute('download', safeName(this.meta.filename, this.meta.media_type));
    a.setAttribute('rel', 'noopener');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.done = true;
    this.meta = { ...this.meta, opens_left: Math.max(0, (this.meta.opens_left ?? 1) - 1) };
    this.render();
  }

  private until(): string {
    const at = this.meta ? new Date(this.meta.expires_at) : null;
    if (!at || Number.isNaN(at.getTime())) return '';
    try {
      return at.toLocaleString(this.lang === 'he' ? 'he-IL' : this.lang, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return at.toISOString().slice(0, 16).replace('T', ' ');
    }
  }

  private render(): void {
    const org = this.meta?.organization ?? '';
    document.documentElement.lang = this.lang;
    document.documentElement.dir = RTL.has(this.lang) ? 'rtl' : 'ltr';
    document.title = org || dt(this.lang, 'title');
    const sel = h('select', { class: 'lang', attrs: { 'aria-label': LANG_SELF[this.lang].language },
      on: { change: (e) => { const v = (e.target as HTMLSelectElement).value; if (isLang(v)) { this.lang = v; this.host.setLang(v); this.render(); } } } });
    for (const l of LANGS) sel.appendChild(h('option', { attrs: { value: l, selected: l === this.lang, lang: l } }, LANG_SELF[l].langName));
    const header = h('header', { class: 'top' },
      h('div', { class: 'brand' }, brandMark(org, this.meta?.logo),
        h('div', { class: 'who' }, org ? h('div', { class: 'org', attrs: { dir: 'auto' } }, org) : null, h('div', { class: 'sub' }, dt(this.lang, 'title')))),
      h('div', { class: 'tools' }, sel));
    let body: HTMLElement;
    if (!this.meta) {
      body = h('section', { class: 'card msg' }, this.message ? h('p', { attrs: { role: 'alert' } }, dt(this.lang, this.message))
        : h('div', { class: 'spinner', attrs: { role: 'status' } }));
    } else {
      const left = Number(this.meta.opens_left) || 0;
      body = h('section', { class: 'card consent', attrs: { 'data-doc': true } },
        h('p', { class: 'consent-lead' }, dt(this.lang, 'lead', { until: this.until() })),
        h('p', { attrs: { dir: 'ltr', 'data-doc-name': true } }, safeName(this.meta.filename, this.meta.media_type)),
        h('p', { class: 'consent-small' }, dt(this.lang, 'size', { size: sizeText(Number(this.meta.size)) }), ' · ', dt(this.lang, 'left', { n: String(left) })),
        this.done ? h('p', { attrs: { role: 'status', 'data-doc-done': true } }, dt(this.lang, 'done')) : null,
        this.message ? h('p', { class: 'consent-bad', attrs: { role: 'alert' } }, dt(this.lang, this.message)) : null,
        h('div', { class: 'consent-actions' },
          h('button', { class: 'btn primary', attrs: { type: 'button', disabled: this.busy || left < 1, 'data-doc-download': true },
            on: { click: () => void this.download() } }, dt(this.lang, 'download'))));
    }
    this.host.root.replaceChildren(h('div', { class: 'page consent-page' }, header, h('main', { class: 'center' }, body)));
  }
}

export function mountDocument(host: DocHost): void {
  void new DocPage(host).start();
}
