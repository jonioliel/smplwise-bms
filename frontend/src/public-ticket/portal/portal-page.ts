/**
 * VPORTAL: the vendor portal screen of the public page - a lazy chunk (`portal-page-*`), fetched only when the server says the portal
 * is on (main.ts tryPortal). Screens: the number (one field), the code (sent over WhatsApp; the screen says "if the number is
 * registered" whatever it is), the list (open requests, then the ones finished in the last N months; per item the title, place,
 * status, dates, the quote and the payment request with amount and paid / not paid). An item with a live handler link opens the
 * EXISTING handler page (main.ts takes the token); nothing here writes anything about a request.
 *
 * The session is an HttpOnly cookie the page never sees (`credentials: 'same-origin'`; SameSite=Strict, Secure, path = the portal's
 * API); 30 minutes, never extended - the page returns to the number screen when it ends. DOM from text nodes only (dom.ts); no link is
 * built; the logo comes from brand.ts.
 */
import cssUrl from './portal-page.css?url';
import { withBase } from '../base';
import { brandMark } from '../brand';
import { h, icon } from '../dom';
import { CATALOGUES, isLang, LANGS, RTL, text, type Key, type Labels, type Lang } from '../strings';
import { applyMode, nextChoice, prefersDark, resolveMode, saveChoice, saveServerMode, storedChoice, type ThemeMode } from '../theme';
import { formatWhen } from '../time';
import { canonicalRoot, cleanCode, demandKeys, isView, money, plausiblePhone, quoteKey, refusal, split, type Answer, type PortalConfig, type PortalItem,
  type PortalView } from './portal-model';
import { pt, type PortalKey } from './portal-text';

export interface PortalHost {
  root: HTMLElement;
  chosenLang: Lang | null;
  fallbackLang: Lang;
  setLang(lang: Lang): void;
  openTicket(token: string): void;
  /** VPORTALRFQ: one open request for quotation - his own RFQ link's token; the existing RFQ page takes it (its own code rules) */
  openRfq(token: string): void;
  /** the portal is off (the server's uniform 404) or unreachable: the page's own unavailable screen, as before the portal existed */
  unavailable(): void;
}

type Phase = 'checking' | 'phone' | 'code' | 'list';
const RESEND_S = 60;

async function call(method: 'GET' | 'POST', route: string, body?: unknown): Promise<Answer> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(withBase(route), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin',
      cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data, offline: false };
  } catch {
    return { status: 0, data: null, offline: true };
  }
}

class Portal {
  private phase: Phase = 'checking';
  private lang: Lang;
  private theme: ThemeMode;
  private phone = '';
  private code = '';
  private busy = false;
  private message: { key: PortalKey; tone: 'ok' | 'bad' | 'info'; minutes?: number } | null = null;
  private view: PortalView | null = null;
  private expiresAt = 0;
  private resendAt = 0;
  private timer: number | null = null;
  private countdown: HTMLElement | null = null;
  private dead = false;
  private more: { render(): void; destroy(): void } | null = null; // VPORTALRFQ: the lazy extra sections
  private moreSlot: HTMLElement | null = null;
  private cfg: PortalConfig = { organization: '', logo: null, code_ttl_s: 600, session_ttl_s: 1800 };

  constructor(private host: PortalHost) {
    this.lang = host.chosenLang ?? host.fallbackLang;
    this.theme = 'light';
  }

  async start(): Promise<void> {
    if (!document.querySelector('link[data-portal-css]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.setAttribute('href', cssUrl); // a file of this page's own origin (CSP style-src 'self')
      css.setAttribute('data-portal-css', '');
      document.head.appendChild(css);
    }
    const canon = canonicalRoot(window.location.pathname, import.meta.url); // `/Support` -> `/support/` (base.ts reads the path)
    if (canon) {
      try {
        history.replaceState(null, '', canon);
      } catch {
        /* ignore */
      }
    }
    const a = await call('GET', '/t/api/portal/config');
    if (this.dead) return;
    if (a.status !== 200 || !a.data || typeof a.data !== 'object') {
      this.destroy();
      this.host.unavailable();
      return;
    }
    this.cfg = a.data as PortalConfig;
    if (this.cfg.theme) saveServerMode(this.cfg.theme);
    this.theme = resolveMode(storedChoice(), this.cfg.theme ?? null);
    applyMode(this.theme);
    this.render();
    void this.loadList(true);
    this.timer = window.setInterval(() => this.tick(), 1000);
  }

  destroy(): void {
    this.dead = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.dropMore();
  }

  private dropMore(): void {
    this.more?.destroy();
    this.more = this.moreSlot = null;
  }

  /** VPORTALRFQ: the slot of the extra sections - one element kept across renders, its chunk fetched once (only when a section is on). */
  private moreEl(f: { rfqs: boolean; techs: boolean }): HTMLElement {
    if (this.moreSlot) return this.moreSlot;
    const slot = (this.moreSlot = h('div', { attrs: { 'data-portal-more': true } }));
    void import('./portal-more').then((m) => {
      if (this.moreSlot !== slot) return;
      this.more = m.mountMore(slot, {
        lang: () => this.lang, when: (iso) => this.when(iso), call,
        openRfq: (token) => { this.destroy(); this.host.openRfq(token); },
        gone: () => { this.dropMore(); void this.loadList(); }, // the sections load afresh with the list

      }, f);
    }).catch(() => undefined);
    return slot;
  }

  private tick(): void {
    if (this.dead) return;
    const now = Date.now();
    if (this.phase === 'list' && this.expiresAt && now >= this.expiresAt) {
      this.toPhone({ key: 'expired', tone: 'info' });
      return;
    }
    const cd = this.countdown;
    if (this.phase === 'code' && cd && cd.isConnected) {
      // only the countdown changes (a full render would take the focus from the code field while the vendor types)
      const left = Math.ceil((this.resendAt - now) / 1000);
      if (left > 0) cd.textContent = this.t('resendIn', { s: left });
      else {
        this.countdown = null;
        cd.replaceWith(this.resendButton());
      }
    }
  }

  private resendButton(): HTMLElement {
    return h('button', { class: 'linkish', attrs: { type: 'button', 'data-portal-resend': true }, on: { click: () => void this.sendCode() } }, this.t('resend'));
  }

  private labels(): Labels | null {
    return this.view?.labels ?? null;
  }

  private t(key: PortalKey, vars: Record<string, string | number> = {}): string {
    return pt(this.lang, key, vars);
  }

  private s(key: Key, vars: Record<string, string | number> = {}): string {
    return text(this.lang, key, vars, this.labels());
  }

  private when(iso: string | null | undefined): string {
    return formatWhen(iso, this.view?.time_zone ?? 'Asia/Jerusalem', this.lang);
  }

  private toPhone(message: Portal['message']): void {
    this.dropMore();
    this.view = null;
    this.expiresAt = 0;
    this.code = '';
    this.phase = 'phone';
    this.message = message;
    this.render();
  }

  // ---------------------------------------------------------------- calls

  private async loadList(first = false): Promise<void> {
    const a = await call('GET', '/t/api/portal/items');
    if (this.dead) return;
    if (a.status === 200 && isView(a.data)) {
      this.view = a.data;
      this.expiresAt = Date.now() + a.data.expires_in_s * 1000;
      if (!this.host.chosenLang && isLang(a.data.lang)) this.lang = a.data.lang;
      this.phase = 'list';
      this.message = null;
      this.render();
      return;
    }
    if (a.status === 404) {
      this.toPhone(first ? null : { key: 'expired', tone: 'info' });
      return;
    }
    this.phase = first ? 'phone' : this.phase;
    this.message = { ...refusal(a), tone: 'bad' };
    this.render();
  }

  private async sendCode(): Promise<void> {
    if (this.busy) return;
    if (!plausiblePhone(this.phone)) {
      this.message = { key: 'badPhone', tone: 'bad' };
      this.render();
      return;
    }
    this.busy = true;
    this.render();
    const a = await call('POST', '/t/api/portal/start', { phone: this.phone });
    this.busy = false;
    if (this.dead) return;
    if (a.status === 202) {
      this.phase = 'code';
      this.code = '';
      this.resendAt = Date.now() + RESEND_S * 1000;
      this.message = { key: 'sentIf', tone: 'info' };
    } else {
      const r = refusal(a);
      this.message = { key: r.key, minutes: r.minutes, tone: 'bad' };
    }
    this.render();
  }

  private async verify(): Promise<void> {
    if (this.busy) return;
    const code = cleanCode(this.code);
    if (!code) {
      this.message = { key: 'badCode', tone: 'bad' };
      this.render();
      return;
    }
    this.busy = true;
    this.render();
    const a = await call('POST', '/t/api/portal/verify', { phone: this.phone, code });
    this.busy = false;
    if (this.dead) return;
    if (a.status === 200) {
      this.code = '';
      await this.loadList();
      return;
    }
    const r = refusal(a);
    this.message = { key: r.key, minutes: r.minutes, tone: 'bad' };
    this.render();
  }

  private async open(item: PortalItem): Promise<void> {
    if (this.busy || !item.can_open) return;
    this.busy = true;
    this.render();
    const a = await call('POST', '/t/api/portal/open', { item: item.id });
    this.busy = false;
    if (this.dead) return;
    const token = a.status === 200 && a.data && typeof a.data === 'object' ? (a.data as { token?: unknown }).token : null;
    if (typeof token === 'string' && token) {
      this.destroy();
      this.host.openTicket(token);
      return;
    }
    if (a.status === 404) {
      await this.loadList(); // the session ended, or the item's link did: the list says which
      return;
    }
    this.message = { ...refusal(a), tone: 'bad' };
    this.render();
  }

  private async logout(): Promise<void> {
    await call('POST', '/t/api/portal/logout', {});
    if (this.dead) return;
    this.phone = '';
    this.toPhone({ key: 'signedOut', tone: 'ok' });
  }

  // ---------------------------------------------------------------- rendering

  private render(): void {
    if (this.dead) return;
    document.documentElement.lang = this.lang;
    document.documentElement.dir = RTL.has(this.lang) ? 'rtl' : 'ltr';
    document.title = this.cfg.organization || this.t('title');
    const main = this.phase === 'list' ? this.list() : this.phase === 'checking'
      ? h('main', { class: 'center' }, h('section', { class: 'card msg' }, h('div', { class: 'spinner', attrs: { role: 'status' } })))
      : this.signIn();
    this.host.root.replaceChildren(h('div', { class: 'page portal', attrs: { 'data-portal': this.phase } }, this.header(), main));
  }

  private header(): HTMLElement {
    const org = this.cfg.organization || '';
    return h('header', { class: 'top' },
      h('div', { class: 'brand' },
        brandMark(org, this.cfg.logo),
        h('div', { class: 'who' },
          org ? h('div', { class: 'org', attrs: { dir: 'auto' } }, org) : null,
          h('div', { class: 'sub' }, this.t('title')))),
      h('div', { class: 'tools' },
        this.phase === 'list' ? h('button', { class: 'btn ghost small', attrs: { type: 'button', 'data-portal-logout': true }, on: { click: () => void this.logout() } },
          this.t('logout')) : null,
        this.themeToggle(), this.langPicker()));
  }

  private themeToggle(): HTMLElement {
    const dark = this.theme === 'dark' || (this.theme === 'auto' && prefersDark());
    return h('button', { class: 'icon-btn', attrs: { type: 'button', 'aria-label': this.s(dark ? 'themeToLight' : 'themeToDark') },
      on: { click: () => { const c = nextChoice(this.theme, prefersDark()); saveChoice(c); this.theme = c; applyMode(c); this.render(); } } }, icon(dark ? 'sun' : 'moon'));
  }

  private langPicker(): HTMLElement {
    const sel = h('select', { class: 'lang', attrs: { 'aria-label': this.s('language') },
      on: { change: (e) => { const v = (e.target as HTMLSelectElement).value; if (isLang(v)) { this.lang = v; this.host.setLang(v); this.render(); } } } });
    for (const l of LANGS) sel.appendChild(h('option', { attrs: { value: l, selected: l === this.lang, lang: l } }, CATALOGUES[l].langName));
    return sel;
  }

  private banner(): HTMLElement | null {
    const m = this.message;
    if (!m) return null;
    return h('div', { class: `banner ${m.tone}`, attrs: { role: m.tone === 'bad' ? 'alert' : 'status', 'data-portal-msg': m.key } },
      this.t(m.key, { m: m.minutes ?? 1 }));
  }

  private signIn(): HTMLElement {
    const codeStep = this.phase === 'code';
    const phone = h('input', { class: 'input', attrs: { type: 'tel', inputmode: 'tel', autocomplete: 'tel', dir: 'ltr', maxlength: 24,
      'aria-label': this.t('phone'), placeholder: this.t('phoneHint'), 'data-portal-phone': true, readonly: codeStep },
    on: { input: (e) => { this.phone = (e.target as HTMLInputElement).value; } } });
    phone.value = this.phone;
    const content: (HTMLElement | null)[] = [
      h('h1', { class: 'msg-title' }, this.t('title')),
      codeStep ? null : h('p', { class: 'msg-body' }, this.t('intro')),
      this.banner(),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, this.t('phone')), phone),
    ];
    if (!codeStep) {
      content.push(h('button', { class: 'btn primary block', attrs: { type: 'submit', disabled: this.busy, 'data-portal-send': true } },
        this.busy ? this.t('sending') : this.t('sendCode')));
    } else {
      const code = h('input', { class: 'input code', attrs: { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 9, dir: 'ltr',
        'aria-label': this.t('code'), 'data-portal-code': true }, on: { input: (e) => { this.code = (e.target as HTMLInputElement).value; } } });
      code.value = this.code;
      const left = Math.max(0, Math.ceil((this.resendAt - Date.now()) / 1000));
      this.countdown = left > 0 ? h('span', { class: 'muted small', attrs: { 'data-portal-countdown': true } }, this.t('resendIn', { s: left })) : null;
      content.push(
        h('label', { class: 'field' }, h('span', { class: 'lbl' }, this.t('code')), code),
        h('button', { class: 'btn primary block', attrs: { type: 'submit', disabled: this.busy, 'data-portal-verify': true } }, this.t('verify')),
        h('div', { class: 'row wrap portal-links' },
          this.countdown ?? this.resendButton(),
          h('button', { class: 'linkish', attrs: { type: 'button' }, on: { click: () => { this.phase = 'phone'; this.message = null; this.render(); } } },
            this.t('otherNumber'))));
    }
    const form = h('form', { class: 'card portal-form', attrs: { novalidate: true },
      on: { submit: (e) => { e.preventDefault(); void (codeStep ? this.verify() : this.sendCode()); } } }, ...content);
    return h('main', { class: 'center' }, form);
  }

  private list(): HTMLElement {
    const v = this.view as PortalView;
    const { open, closed } = split(v.items);
    const until = new Date(this.expiresAt).toISOString();
    const f = v.features;
    if (!f?.rfqs && !f?.techs) this.dropMore();
    else this.more?.render(); // the language may have changed
    return h('main', { class: 'col' },
      this.banner(),
      h('p', { class: 'muted small', attrs: { 'data-portal-until': true } }, this.t('until', { when: this.when(until) })),
      h('h2', { class: 'portal-h' }, this.t('openNow'), ` (${open.length})`),
      ...(open.length ? open.map((i) => this.card(i)) : [h('p', { class: 'muted' }, this.t('none'))]),
      f && (f.rfqs || f.techs) ? this.moreEl(f) : null,
      h('h2', { class: 'portal-h' }, this.t('closedIn', { n: v.closed_months }), ` (${closed.length})`),
      ...(closed.length ? closed.map((i) => this.card(i)) : [h('p', { class: 'muted' }, this.t('none'))]));
  }

  private statusWord(i: PortalItem): string {
    if (i.status === 'ended') return this.t(i.end_reason === 'returned' ? 'e_returned' : 'e_reassigned');
    return this.s(`s_${i.status}` as Key);
  }

  private card(i: PortalItem): HTMLElement {
    const lang = this.lang;
    const q = i.quote;
    const d = i.demand;
    const dk = d ? demandKeys(d) : null;
    return h('section', { class: 'card portal-item', attrs: { 'data-portal-item': i.number } },
      h('div', { class: 'row wrap' },
        h('span', { class: 'chip num-chip' }, this.s('number', { number: i.number })),
        h('span', { class: `chip st-${i.status}` }, this.statusWord(i))),
      h('div', { class: 'title', attrs: { dir: 'auto' } }, i.title),
      i.place ? h('div', { class: 'where' }, icon('pin'), h('span', { attrs: { dir: 'auto' } }, i.place)) : null,
      i.department ? h('div', { class: 'muted small', attrs: { dir: 'auto' } }, i.department) : null,
      h('div', { class: 'muted small' },
        this.t('assigned', { when: this.when(i.assigned_at) }),
        i.ended_at ? ` · ${this.t('ended', { when: this.when(i.ended_at) })}` : '',
        i.eta_at ? ` · ${this.t('eta', { when: this.when(i.eta_at) })}` : ''),
      q ? h('div', { class: 'portal-money', attrs: { 'data-portal-quote': q.state } }, icon('coin'),
        h('span', null, `${this.t('quote')}: `, h('bdi', null, money(q.total_minor, q.currency, lang)), ` · ${this.t(quoteKey(q))}`)) : null,
      d && dk ? h('div', { class: `portal-money${d.paid ? ' paid' : ''}`, attrs: { 'data-portal-demand': d.status } }, icon('coin'),
        h('span', null, `${this.t('demand')}: `,
          dk.amount && d.total_minor !== null ? h('bdi', null, money(d.total_minor, d.currency, lang)) : this.t('noAmount'),
          ` · ${this.t(dk.key)}`)) : null,
      i.can_open
        ? h('button', { class: 'btn block', attrs: { type: 'button', disabled: this.busy, 'data-portal-open': i.number }, on: { click: () => void this.open(i) } },
          this.t('openItem'))
        : (i.state === 'open' ? h('p', { class: 'muted small' }, this.t('noLink')) : null));
  }
}

/** Mounts the portal into the page's root. The returned handle stops it (main.ts, when an item's handler page opens). */
export function mountPortal(host: PortalHost): { destroy(): void } {
  const p = new Portal(host);
  void p.start();
  return p;
}
