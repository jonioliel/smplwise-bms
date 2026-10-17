/**
 * WA-CONSENT-LINK: the WhatsApp consent page - a lazy chunk (`consent-page-*`), fetched only for a `#c.<token>` link (main.ts). One card:
 * the organisation's name and logo, the notice, two buttons (approve / decline). Nothing personal is shown (no name, no number): the
 * server sends none. The token stays in memory only (never in sessionStorage, never in the address bar - main.ts already replaced it) and
 * travels in the `X-Ticket-Token` header; no cookie (`credentials: 'omit'`), nothing cached, a redirect is an error. The answer is single
 * use on the server: a second answer, an expired or unknown link is the page's own "unavailable" screen (the uniform 404).
 */
import cssUrl from './consent-page.css?url';
import { withBase } from '../base';
import { brandMark } from '../brand';
import { h } from '../dom';
import { CATALOGUES, isLang, LANGS, RTL, type Lang } from '../strings';
import { applyMode, resolveMode, saveServerMode, storedChoice } from '../theme';
import { ct, type ConsentKey } from './consent-text';

export interface ConsentHost {
  root: HTMLElement;
  token: string;
  lang: Lang;
  setLang(lang: Lang): void;
  unavailable(): void;
}

interface View { organization: string; logo: string | null; theme?: 'light' | 'dark' | 'auto'; notice_version: string; lang: string }

async function call(token: string, method: 'GET' | 'POST', body?: unknown): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Ticket-Token': token };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(withBase('/t/api/consent'), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit',
      cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

/** What an answer to the POST means for the page (pure; unit-tested). */
export function outcomeOf(status: number, data: unknown): 'approved' | 'declined' | 'unavailable' | 'reload' | ConsentKey {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  if (status === 200) return d.answer === 'declined' ? 'declined' : 'approved';
  if (status === 404) return 'unavailable';
  if (status === 409 && d.code === 'notice_changed') return 'reload';
  if (status === 429) return 'rateLimited';
  if (status === 0) return 'offline';
  return 'error';
}

class Consent {
  private lang: Lang;
  private view: View | null = null;
  private done: 'approved' | 'declined' | null = null;
  private busy = false;
  private message: ConsentKey | null = null;

  constructor(private host: ConsentHost) {
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
    await this.load();
  }

  private async load(): Promise<void> {
    const a = await call(this.host.token, 'GET');
    if (a.status !== 200 || !a.data || typeof a.data !== 'object') {
      if (a.status === 429 || a.status === 0) {
        this.message = a.status === 0 ? 'offline' : 'rateLimited';
        this.render();
        return;
      }
      this.host.unavailable();
      return;
    }
    this.view = a.data as View;
    if (isLang(this.view.lang) && this.lang === this.host.lang) this.lang = this.view.lang; // the request's language unless the person chose one
    if (this.view.theme) saveServerMode(this.view.theme);
    applyMode(resolveMode(storedChoice(), this.view.theme ?? null));
    this.render();
  }

  private async answer(choice: 'approve' | 'decline'): Promise<void> {
    if (this.busy || !this.view) return;
    this.busy = true;
    this.message = null;
    this.render();
    const a = await call(this.host.token, 'POST', { choice, notice_version: this.view.notice_version });
    this.busy = false;
    const next = outcomeOf(a.status, a.data);
    if (next === 'unavailable') {
      this.host.unavailable();
      return;
    }
    if (next === 'reload') {
      await this.load(); // the notice changed since the page opened: show the current one, the person answers again
      return;
    }
    if (next === 'approved' || next === 'declined') this.done = next;
    else this.message = next;
    this.render();
  }

  private render(): void {
    const org = this.view?.organization ?? '';
    document.documentElement.lang = this.lang;
    document.documentElement.dir = RTL.has(this.lang) ? 'rtl' : 'ltr';
    document.title = org || ct(this.lang, 'title');
    const sel = h('select', { class: 'lang', attrs: { 'aria-label': CATALOGUES[this.lang].language },
      on: { change: (e) => { const v = (e.target as HTMLSelectElement).value; if (isLang(v)) { this.lang = v; this.host.setLang(v); this.render(); } } } });
    for (const l of LANGS) sel.appendChild(h('option', { attrs: { value: l, selected: l === this.lang, lang: l } }, CATALOGUES[l].langName));
    const header = h('header', { class: 'top' },
      h('div', { class: 'brand' }, brandMark(org, this.view?.logo),
        h('div', { class: 'who' }, org ? h('div', { class: 'org', attrs: { dir: 'auto' } }, org) : null, h('div', { class: 'sub' }, ct(this.lang, 'title')))),
      h('div', { class: 'tools' }, sel));
    const vars = { org: org || '…' };
    let body: HTMLElement;
    if (!this.view) {
      body = h('section', { class: 'card msg' }, this.message ? h('p', { attrs: { role: 'alert' } }, ct(this.lang, this.message))
        : h('div', { class: 'spinner', attrs: { role: 'status' } }));
    } else if (this.done) {
      body = h('section', { class: 'card msg', attrs: { 'data-consent-done': this.done } },
        h('p', { class: 'consent-lead', attrs: { role: 'status' } }, ct(this.lang, this.done)), h('p', null, ct(this.lang, 'close')));
    } else {
      body = h('section', { class: 'card consent' },
        h('p', { class: 'consent-lead', attrs: { dir: 'auto' } }, ct(this.lang, 'notice', vars)),
        h('p', null, ct(this.lang, 'noCode')),
        h('p', { class: 'consent-small', attrs: { dir: 'auto' } }, ct(this.lang, 'revoke', vars)),
        this.message ? h('p', { class: 'consent-bad', attrs: { role: 'alert' } }, ct(this.lang, this.message)) : null,
        h('div', { class: 'consent-actions' },
          h('button', { class: 'btn primary', attrs: { type: 'button', disabled: this.busy, 'data-consent-approve': true }, on: { click: () => void this.answer('approve') } },
            ct(this.lang, 'approve')),
          h('button', { class: 'btn ghost', attrs: { type: 'button', disabled: this.busy, 'data-consent-decline': true }, on: { click: () => void this.answer('decline') } },
            ct(this.lang, 'decline'))));
    }
    this.host.root.replaceChildren(h('div', { class: 'page consent-page' }, header, h('main', { class: 'center' }, body)));
  }
}

export function mountConsent(host: ConsentHost): void {
  void new Consent(host).start();
}
