/**
 * TKRFQVP (release 2.6.0, contract section 15): the request-for-quotation mode of the public page - what a vendor sees after tapping
 * the invitation (`<base>/<prefix>/#q.<token>`, or the e-mail form whose redeem answer says `kind: "rfq"`). A lazy chunk of the same
 * bundle: the ticket page never loads it. Same look as the ticket page (styles.css cards, the quote card's form language from
 * claim.css), mobile first, one column, 44 px targets, the page's language and direction, light / dark by theme.ts.
 *
 * Screens: the code gate (when the link requires a code - reference, organisation and department only); the request card (title,
 * description, place, deadline with the time left, the wanted work dates, the line kinds); the quote form (only the allowed kinds, the
 * currency when there is a choice, VAT, work dates with a gentle warning outside the wanted dates, valid-until, the vendor's own quote
 * number, notes, a client-side preview of the figures - the server computes the real ones); the confirmation (the server's amounts)
 * with update / withdraw; "not interested" with an optional reason and a confirm step; the clarification thread; and the end states
 * from `page_state` (deadline passed, selected - his own approved part, closed - no price and no hint about others, cancelled).
 *
 * Every write carries a client request id kept while its outcome is unknown (bad reception, a busy server): a retry is the same
 * request. Text only through dom.ts `h` (text nodes); no link is ever built from typed text.
 */
import './rfq.css';
import { newRequestId, rfqApi, type ApiFailure, type Credentials, type RfqQuote, type RfqView } from '../api';
import { brandMark } from '../brand';
import { h, icon } from '../dom';
import { codeMessage, validSession } from '../state';
import { CATALOGUES, isLang, LANGS, RTL, text, type Key, type Lang } from '../strings';
import { applyMode, nextChoice, prefersDark, resolveMode, saveChoice, saveServerMode, storedChoice, type ThemeMode } from '../theme';
import { formatDate, formatWhen, zoneNote } from '../time';
import { computeForm, formatMoney, formatRate, newLine, type LineDraft, type LineKind } from '../claim/claim-model';
import { claimLang, ct, errorText, type ClaimTextKey } from '../claim/claim-text';
import { rfqText, isRfqKey, type RfqKey } from './rfq-text';
import { filesCard } from './rfq-files';
// CR-RFQ-PAYMENT-SCHEDULE: the terms module is its own lazy chunk (`rfq-page-terms-*`), fetched only when the answer carries
// `form.payment` or `terms` (the installation switch is OFF by default) - integ/264 RFQ budget decision (a)
import type { ArrivalUi, TermsHost } from './rfq-page-terms';
type TermsModule = typeof import('./rfq-page-terms');
import {
  bodySig, cridFor, draftFromQuote, draftProblems, freshDraft, isoToDay, kindList, outsideWindow, parseRfqDraft, quoteWire, quoting, rfqFailure, rfqKinds, rfqScreen,
  rfqSettings, safeMapUrl, timeLeft, type RfqDraft, type RfqScreen,
} from './rfq-state';

export interface RfqHost {
  root: HTMLElement;
  token: string;
  /** the language the vendor chose on this page earlier (null = the server's) and the fallback before any answer */
  chosenLang: Lang | null;
  fallbackLang: Lang;
  /** this tab's storage (sessionStorage through main.ts, every access guarded) */
  stored(key: 'session' | 'draft'): string | null;
  store(key: 'session' | 'draft' | 'lang', value: string | null): void;
  /** the link is dead or the vendor tapped "finish": forget the token and everything kept with it */
  forget(): void;
}

type Phase = 'loading' | 'ready' | 'unavailable' | 'busy' | 'error' | 'finished';
type Slot = 'quote' | 'withdraw' | 'decline' | 'message' | 'arrival';
type Pending = { crid: string; sig: string };

const DAY_MS = 86_400_000;

class RfqPage {
  private host: RfqHost;
  private creds: Credentials;
  private phase: Phase = 'loading';
  private view: RfqView | null = null;
  private lang: Lang;
  private theme: ThemeMode = 'light';
  private banner: { key: string; tone: 'ok' | 'bad' | 'info'; n?: number } | null = null;
  private busy = false;
  private code = { sent: false, value: '', message: null as null | { key: string; n?: number } };
  private draft: RfqDraft | null = null;
  private editing = false;
  private showErrors = false;
  private pending: Partial<Record<Slot, Pending>> = {};
  private declineOpen = false;
  private declineReason = '';
  private withdrawOpen = false;
  private ask = '';
  /** CR-RFQ-PAYMENT-SCHEDULE: the acknowledgement box and the "another date" fields of the arrival confirmation */
  private arrivalUi: ArrivalUi = { ack: false, open: false, from: '', to: '' };
  /** the lazy terms module once fetched; `termsAsked` = the fetch was started (a failed fetch may be asked again) */
  private terms: TermsModule | null = null;
  private termsAsked = false;
  /** a draft kept in this tab from before a reload: an update of a live quote reopens the form */
  private restored = false;
  /** a kept draft of a FIRST quote: dropped when a live quote exists meanwhile (it was sent, perhaps from another device) */
  private restoredNew = false;
  private figuresHost: HTMLElement | null = null;
  private warnHost: HTMLElement | null = null;
  private errorHost: HTMLElement | null = null;
  private linesHost: HTMLElement | null = null;

  constructor(host: RfqHost) {
    this.host = host;
    this.creds = { token: host.token, session: validSession(host.stored('session')) };
    this.lang = host.chosenLang ?? host.fallbackLang;
    const kept = this.readKept();
    if (kept) {
      this.draft = kept.draft;
      this.restored = !!kept.draft && kept.editing;
      this.restoredNew = !!kept.draft && !kept.editing;
      if (kept.pending) this.pending.quote = kept.pending;
    }
  }

  start(): void {
    void this.load();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.creds.token && ['ready', 'busy', 'error'].includes(this.phase) && !this.busy) void this.load(false);
    });
  }

  // ---------------------------------------------------------------- words and times

  private t(key: RfqKey | Key | string, vars: Record<string, string | number> = {}): string {
    return isRfqKey(key) ? rfqText(this.lang, key, vars) : text(this.lang, key as Key, vars);
  }

  private c(key: ClaimTextKey, vars?: Record<string, string | number>): string {
    return ct(claimLang(this.lang), key, vars);
  }

  private zone(): string {
    return this.view?.time_zone ?? 'Asia/Jerusalem';
  }

  private when(iso: string | null | undefined): string {
    return formatWhen(iso, this.zone(), this.lang);
  }

  private day(iso: string | null | undefined): string {
    return formatDate(iso, this.zone(), this.lang);
  }

  private money(minor: number, currency: string): string {
    return formatMoney(minor, currency, this.lang);
  }

  private kindName(k: LineKind): string {
    return this.c(`kind_${k}` as ClaimTextKey);
  }

  // ---------------------------------------------------------------- the kept draft (this tab only)

  private readKept(): { draft: RfqDraft | null; pending: Pending | null; editing: boolean } | null {
    const raw = this.host.stored('draft');
    if (!raw) return null;
    try {
      const v = JSON.parse(raw) as { d?: unknown; p?: { crid?: unknown; sig?: unknown }; e?: unknown };
      const draft = parseRfqDraft(JSON.stringify(v.d ?? null));
      const p = v.p && typeof v.p.crid === 'string' && /^[0-9a-f-]{36}$/i.test(v.p.crid) && typeof v.p.sig === 'string' ? { crid: v.p.crid, sig: v.p.sig } : null;
      return { draft, pending: p, editing: v.e === true };
    } catch {
      return null;
    }
  }

  private keep(): void {
    if (!this.draft) this.host.store('draft', null);
    else this.host.store('draft', JSON.stringify({ d: this.draft, p: this.pending.quote ?? null, e: this.editing }));
  }

  // ---------------------------------------------------------------- loading

  private async load(showLoading = true): Promise<void> {
    if (showLoading && !this.view) {
      this.phase = 'loading';
      this.render();
    }
    const r = await rfqApi.view(this.creds);
    if (!r.ok) {
      const next = rfqFailure(r.error);
      if (next.unavailable) return this.dead();
      if (r.error.status === 429) this.phase = this.view ? 'ready' : 'busy';
      else this.phase = this.view ? 'ready' : 'error';
      this.banner = this.view && next.message ? { key: next.message, tone: 'bad', n: next.n } : null;
      this.render();
      return;
    }
    const v = r.data;
    this.view = v;
    if (v.theme) saveServerMode(v.theme);
    this.theme = resolveMode(storedChoice(), v.theme);
    applyMode(this.theme);
    this.lang = this.host.chosenLang ?? (isLang(v.lang) ? v.lang : this.host.fallbackLang);
    this.phase = 'ready';
    const screen = rfqScreen(v);
    if (screen === 'code' && (v.code_locked_s ?? 0) > 0) this.code.message = { key: 'codeLocked', n: Math.ceil((v.code_locked_s ?? 60) / 60) };
    const live = v.quote?.state === 'submitted';
    if (this.restored && live && v.can?.quote) this.editing = true;
    if ((this.restoredNew || this.restored) && live && !this.editing) {
      this.draft = null;
      this.pending = {};
      this.keep();
    }
    this.restored = this.restoredNew = false;
    if (!v.can?.quote) this.editing = false;
    this.render();
  }

  /** 404: the uniform "unavailable" (unknown, expired, revoked, past its grace - the page cannot and must not tell them apart). */
  private dead(): void {
    this.host.forget();
    this.view = null;
    this.draft = null;
    this.pending = {};
    this.phase = 'unavailable';
    this.render();
  }

  /** One write: the request id of this content (kept while the outcome is unknown), the refusal in words, a reload when the state moved. */
  private async write<T>(slot: Slot, body: Record<string, unknown>, call: (crid: string) => Promise<{ ok: true; data: T } | { ok: false; error: ApiFailure }>): Promise<T | null> {
    if (this.busy) return null;
    const p = cridFor(this.pending[slot] ?? null, bodySig(body), newRequestId);
    this.pending[slot] = p;
    if (slot === 'quote') this.keep(); // the id is kept BEFORE anything is sent: a retry after a reload is the same request
    this.busy = true;
    this.banner = null;
    this.render();
    const r = await call(p.crid);
    this.busy = false;
    if (r.ok) {
      delete this.pending[slot];
      return r.data;
    }
    const next = rfqFailure(r.error);
    if (!next.keepCrid) delete this.pending[slot];
    if (slot === 'quote') this.keep();
    if (next.unavailable) {
      this.dead();
      return null;
    }
    if (next.code) {
      this.creds.session = null;
      this.host.store('session', null);
    }
    this.banner = next.message ? { key: next.message, tone: next.message === 'r_offline' ? 'info' : 'bad', n: next.n } : null;
    if (next.reload || next.code) await this.load(false);
    else this.render();
    return null;
  }

  // ---------------------------------------------------------------- actions

  private formDraft(): RfqDraft {
    const v = this.view as RfqView;
    if (!this.draft) {
      const q = v.quote;
      this.draft = this.editing && q && q.state !== 'withdrawn' ? draftFromQuote(q, v) : freshDraft(v);
    }
    return this.draft;
  }

  private async submitQuote(): Promise<void> {
    const v = this.view;
    if (!v || !this.draft) return;
    this.showErrors = true;
    const problems = draftProblems(this.draft, v, Date.now());
    if (problems.length) {
      this.paintErrors();
      return;
    }
    const body = quoteWire(this.draft, v, '');
    const out = await this.write('quote', body, (crid) => rfqApi.quote(this.creds, { ...body, client_request_id: crid }));
    if (!out) {
      // the quote changed meanwhile (another device): the page reloaded; his inputs stay in the form, against the new version
      if (this.banner?.key === 'r_e_quote_changed' && this.view?.can?.quote) {
        this.editing = true;
        this.render();
      }
      return;
    }
    const asked = typeof body.question === 'string';
    this.draft = null;
    this.editing = false;
    this.showErrors = false;
    this.keep();
    this.banner = { key: asked ? 'sentAsked' : 'sentOk', tone: 'ok' };
    if (out.quote) this.view = { ...v, quote: out.quote };
    await this.load(false);
  }

  private async withdraw(): Promise<void> {
    const q = this.view?.quote;
    if (!q) return;
    const out = await this.write('withdraw', { quote_id: q.id }, (crid) => rfqApi.withdraw(this.creds, q.id, crid));
    if (!out) return;
    this.withdrawOpen = false;
    this.editing = false;
    this.draft = null;
    this.keep();
    this.banner = { key: 'withdrawnTitle', tone: 'ok' };
    await this.load(false);
  }

  private async decline(): Promise<void> {
    const reason = this.declineReason.trim();
    const out = await this.write('decline', { reason }, (crid) => rfqApi.decline(this.creds, reason, crid));
    if (!out) return;
    this.declineOpen = false;
    this.declineReason = '';
    this.banner = { key: 'saved', tone: 'ok' };
    await this.load(false);
  }

  private async sendQuestion(): Promise<void> {
    const msg = this.ask.trim();
    if (!msg) return;
    const out = await this.write('message', { text: msg }, (crid) => rfqApi.message(this.creds, msg, crid));
    if (!out) return;
    this.ask = '';
    this.banner = { key: 'asked', tone: 'ok' };
    await this.load(false);
  }

  /** CR-RFQ-PAYMENT-SCHEDULE: confirm the planned arrival or propose another date (both acknowledge the approved schedule). */
  private async arrival(action: 'confirm' | 'propose'): Promise<void> {
    const v = this.view;
    if (!v) return;
    if (!this.terms) return; // the confirm / propose buttons exist only once the terms module rendered them
    const body = this.terms.arrivalWire(action, this.arrivalUi, v.time_zone);
    const out = await this.write('arrival', body, (crid) => rfqApi.arrival(this.creds, { ...body, client_request_id: crid }));
    if (!out) return;
    this.arrivalUi = { ack: false, open: false, from: '', to: '' };
    this.banner = { key: 'saved', tone: 'ok' };
    await this.load(false);
  }

  /** Fetch the terms module when this answer needs it (a payment form or approved terms); renders again once it is here. */
  private needTerms(): void {
    const v = this.view;
    if (this.terms || this.termsAsked || !v || !(v.form?.payment || v.terms)) return;
    this.termsAsked = true;
    import('./rfq-page-terms').then((m) => { this.terms = m; this.render(); }, () => { this.termsAsked = false; });
  }

  /** The page as the terms module sees it (words, money, dates, the busy flag, keep / render). */
  private termsHost(): TermsHost {
    return {
      t: (key, vars) => this.t(key, vars),
      money: (minor, currency) => this.money(minor, currency),
      totalLabel: () => this.c('total'),
      day: (iso) => this.day(iso),
      busy: this.busy,
      keep: () => this.keep(),
      render: () => this.render(),
    };
  }

  private async codeSend(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    const r = await rfqApi.codeSend(this.creds);
    this.busy = false;
    if (!r.ok) {
      if (r.error.status === 404) return this.dead();
      this.code.message = codeMessage(r.error);
      this.render();
      return;
    }
    this.code = { sent: true, value: '', message: { key: r.data.channel === 'whatsapp' ? 'codeSentWa' : 'codeSent', n: Math.max(1, Math.round((r.data.expires_in_s || 600) / 60)) } };
    this.render();
  }

  private async codeVerify(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    const r = await rfqApi.codeVerify(this.creds, this.code.value);
    this.busy = false;
    if (!r.ok) {
      if (r.error.status === 404) return this.dead();
      this.code.message = codeMessage(r.error);
      this.render();
      return;
    }
    this.creds.session = r.data.session;
    this.host.store('session', r.data.session);
    this.code = { sent: false, value: '', message: null };
    await this.load(false);
  }

  private finish(): void {
    this.host.forget();
    this.view = null;
    this.draft = null;
    this.pending = {};
    this.phase = 'finished';
    this.render();
  }

  // ---------------------------------------------------------------- rendering

  private render(): void {
    this.needTerms();
    document.documentElement.lang = this.lang;
    document.documentElement.dir = RTL.has(this.lang) ? 'rtl' : 'ltr';
    document.title = this.view?.organization || this.t('pageTitle');
    this.figuresHost = this.warnHost = this.errorHost = this.linesHost = null;
    this.host.root.replaceChildren(this.body());
    if (this.draft && this.figuresHost) {
      this.paintFigures();
      this.paintErrors();
    }
  }

  private body(): HTMLElement {
    switch (this.phase) {
      case 'loading':
        return this.msgScreen([h('div', { class: 'spinner', attrs: { role: 'status', 'aria-label': this.t('loading') } })]);
      case 'unavailable':
        return this.message('unavailableTitle', 'unavailableBody', 'lock');
      case 'busy':
        return this.message('busyTitle', 'busyBody', 'clock', true);
      case 'error':
        return this.message('errorTitle', 'errorBody', 'clock', true);
      case 'finished':
        return this.message('finishedTitle', 'finishedBody', 'out');
      default:
        return this.view && rfqScreen(this.view) === 'code' ? this.codeScreen(this.view) : this.rfqScreenEl();
    }
  }

  private msgScreen(content: (Node | null)[]): HTMLElement {
    return h('div', { class: 'page rfq' }, this.view ? this.header(this.view) : null, h('main', { class: 'center' }, h('section', { class: 'card msg' }, ...content)));
  }

  private message(title: Key, bodyKey: Key, ic: string, retry = false): HTMLElement {
    return this.msgScreen([
      h('div', { class: 'msg-icon' }, icon(ic)),
      h('h1', { class: 'msg-title', attrs: { 'data-state-title': title } }, this.t(title)),
      h('p', { class: 'msg-body' }, this.t(bodyKey)),
      retry && this.creds.token ? h('button', { class: 'btn block', attrs: { type: 'button' }, on: { click: () => void this.load() } }, this.t('retry')) : null,
    ]);
  }

  private header(v: RfqView): HTMLElement {
    const org = v.organization || '';
    return h('header', { class: 'top' },
      h('div', { class: 'brand' },
        brandMark(org, v.logo), // VPORTAL: the logo when one is set, else the initial
        h('div', { class: 'who' },
          org ? h('div', { class: 'org', attrs: { dir: 'auto' } }, org) : null,
          h('div', { class: 'sub', attrs: { 'data-rfq-ref': v.ref } }, h('span', { attrs: { dir: 'ltr' } }, v.ref), v.department ? ` · ${v.department}` : ''))),
      h('div', { class: 'tools' }, this.themeToggle(), this.langPicker()));
  }

  private themeToggle(): HTMLElement {
    const dark = this.theme === 'dark' || (this.theme === 'auto' && prefersDark());
    return h('button', { class: 'icon-btn', attrs: { type: 'button', 'data-theme-toggle': dark ? 'dark' : 'light', 'aria-label': this.t(dark ? 'themeToLight' : 'themeToDark') },
      on: { click: () => { const c = nextChoice(this.theme, prefersDark()); saveChoice(c); this.theme = c; applyMode(c); this.render(); } } }, icon(dark ? 'sun' : 'moon'));
  }

  private langPicker(): HTMLElement {
    const sel = h('select', { class: 'lang', attrs: { 'aria-label': this.t('language'), 'data-lang-picker': true },
      on: { change: (e) => { const value = (e.target as HTMLSelectElement).value; if (isLang(value)) { this.lang = value; this.host.chosenLang = value; this.host.store('lang', value); this.render(); } } } });
    for (const l of LANGS) sel.appendChild(h('option', { attrs: { value: l, selected: l === this.lang, lang: l } }, CATALOGUES[l].langName));
    return sel;
  }

  private bannerEl(): HTMLElement | null {
    const b = this.banner;
    if (!b) return null;
    return h('div', { class: `banner ${b.tone}`, attrs: { role: b.tone === 'bad' ? 'alert' : 'status', 'data-banner': b.key } }, this.t(b.key, { n: b.n ?? '' }));
  }

  private footer(): HTMLElement {
    const v = this.view;
    const note = v ? zoneNote(v.time_zone) : null;
    return h('footer', { class: 'foot' },
      note ? h('div', null, this.t('timeZone', { zone: note })) : null,
      this.lang === 'ar' || this.lang === 'ru' ? h('div', { class: 'prelim', attrs: { 'data-prelim': true } }, this.t('prelim')) : null,
      h('button', { class: 'linkish', attrs: { type: 'button', 'data-finish': true }, on: { click: () => this.finish() } }, this.t('finish')));
  }

  /** The code gate: reference, organisation and department only (the minimal card carries nothing else). The ticket page's flow and words. */
  private codeScreen(v: RfqView): HTMLElement {
    const m = this.code.message;
    const input = h('input', { class: 'input code', attrs: { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 9, 'aria-label': this.t('codeInput'),
      'data-code-input': true, dir: 'ltr' }, on: { input: (e) => { this.code.value = (e.target as HTMLInputElement).value; } } });
    input.value = this.code.value;
    return h('div', { class: 'page rfq', attrs: { 'data-rfq-screen': 'code' } }, this.header(v), h('main', { class: 'col' },
      h('section', { class: 'card code' },
        h('div', { class: 'msg-icon' }, icon('lock')),
        h('h1', { class: 'msg-title' }, this.t('codeTitle')),
        h('p', { class: 'msg-body' }, this.t('codeBody')),
        h('p', { class: 'msg-sub' }, h('span', { attrs: { dir: 'ltr' } }, v.ref), v.department ? ` · ${v.department}` : ''),
        m ? h('div', { class: `banner ${m.key.startsWith('codeSent') ? 'ok' : 'bad'}`, attrs: { role: 'status', 'data-code-message': m.key } }, this.t(m.key, { n: m.n ?? '' })) : null,
        this.code.sent ? h('div', { class: 'row' }, input,
          h('button', { class: 'btn primary', attrs: { type: 'button', disabled: this.busy, 'data-code-verify': true }, on: { click: () => void this.codeVerify() } }, this.t('codeVerify'))) : null,
        h('button', { class: `btn ${this.code.sent ? 'ghost' : 'primary'} block`, attrs: { type: 'button', disabled: this.busy, 'data-code-send': true },
          on: { click: () => void this.codeSend() } }, this.t(this.code.sent ? 'codeResend' : 'codeSend'))),
      this.footer()));
  }

  private rfqScreenEl(): HTMLElement {
    const v = this.view;
    if (!v) return this.message('errorTitle', 'errorBody', 'clock', true);
    const screen = rfqScreen(v);
    const ended = screen === 'closed' || screen === 'cancelled';
    const can = v.can ?? { quote: false, withdraw: false, decline: false, ask: false };
    return h('div', { class: 'page rfq', attrs: { 'data-rfq-screen': screen } }, this.header(v), h('main', { class: 'col' },
      this.bannerEl(),
      v.read_only && v.read_only_until ? h('div', { class: 'banner info', attrs: { role: 'status', 'data-rfq-readonly': true } }, this.t('readOnly', { when: this.when(v.read_only_until) })) : null,
      this.stateCard(v, screen),
      screen === 'awarded' && this.terms ? this.terms.termsCard(this.termsHost(), v, this.arrivalUi, (a) => void this.arrival(a)) : null,
      ended ? null : this.requestCard(v),
      // RFQATT (contract 19.4): the request's files - pictures in a lightbox, documents only as downloads; never on an ended page
      !ended && v.rfq?.attachments?.length ? filesCard(v.rfq.attachments, this.creds, 'rfq', this.lang) : null,
      ended ? null : this.quoteBlock(v, screen),
      !ended && can.decline && screen === 'open' ? this.declineBlock(v) : null,
      ended ? null : this.threadCard(v)),
    this.footer());
  }

  /** The state of the request in one card: deadline passed, selected, closed, cancelled, "not interested". Nothing about other vendors. */
  private stateCard(v: RfqView, screen: RfqScreen): HTMLElement | null {
    const card = (key: RfqKey, ic: string, tone: string, body: RfqKey | null) => h('section', { class: `card msg rfq-state ${tone}`, attrs: { 'data-rfq-state': screen } },
      h('div', { class: `msg-icon ${tone === 'ok' ? 'ok' : ''}` }, icon(ic)),
      h('h1', { class: 'msg-title' }, this.t(key)),
      body ? h('p', { class: 'msg-body' }, this.t(body)) : null);
    switch (screen) {
      case 'closed':
        return card('closedTitle', 'lock', 'mut', null);
      case 'cancelled':
        return card('cancelledTitle', 'lock', 'mut', null);
      case 'due_passed':
        return card('duePassedTitle', 'clock', 'mut', 'duePassedBody');
      case 'awarded':
        return card('awardedTitle', 'done', 'ok', 'awardedBody');
      case 'declined':
        return card('declinedTitle', 'info', 'mut', v.can?.quote ? 'declinedBody' : null);
      default:
        return null;
    }
  }

  /** The request: kind and reference, the title, the place, the deadline with the time left, the wanted work dates, the line kinds, the description. */
  private requestCard(v: RfqView): HTMLElement | null {
    const r = v.rfq;
    if (!r) return null;
    const left = timeLeft(r.due_at, Date.now());
    const leftText = left ? (left.d > 0 ? this.t('leftD', { d: left.d, h: left.h }) : left.h > 0 ? this.t('leftH', { h: left.h, m: left.m }) : this.t('leftM', { m: Math.max(1, left.m) })) : '';
    const win = r.work_from || r.work_to ? [r.work_from ? this.day(r.work_from) : '', r.work_to ? this.day(r.work_to) : ''].filter(Boolean).join(' – ') : this.t('windowAny');
    const row = (label: RfqKey, value: Node | string, attr: string) => h('div', { class: 'rfq-fact', attrs: { [`data-rfq-${attr}`]: true } },
      h('span', { class: 'lbl' }, this.t(label)), typeof value === 'string' ? h('span', { class: 'val' }, value) : value);
    const kinds = kindList(r.allowed_line_kinds);
    return h('section', { class: 'card hero', attrs: { 'data-rfq-request': true } },
      h('div', { class: 'chips' }, h('span', { class: 'chip num-chip' }, this.t('kind')), h('span', { class: 'spacer' }), left ? h('span', { class: 'chip rfq-left', attrs: { 'data-rfq-left': true } }, leftText) : null),
      h('h1', { class: 'title', attrs: { dir: 'auto', 'data-rfq-title': true } }, r.title),
      r.place_text ? h('div', { class: 'where' }, icon('pin'), h('span', { attrs: { dir: 'auto' } }, r.place_text)) : null,
      // CR-ORG-LOCATIONS: the request's location (text only); the map address only when the manager added it - as TEXT (this chunk builds
      // no link, unit-public-rfq), and only the short maps.google.com form the server makes from the coordinates
      r.location?.text ? h('div', { class: 'where', attrs: { 'data-rfq-location': true } }, icon('pin'), h('span', { attrs: { dir: 'auto' } }, r.location.text)) : null,
      safeMapUrl(r.location?.map_url) ? h('div', { class: 'where', attrs: { 'data-rfq-map': true } }, h('span', { class: 'lbl' }, this.t('navigate')),
        h('span', { attrs: { dir: 'ltr' } }, safeMapUrl(r.location?.map_url))) : null,
      h('div', { class: 'rfq-facts' },
        r.due_at ? row('due', h('span', { class: 'val' }, h('b', null, this.when(r.due_at))), 'due') : null,
        row('window', win, 'window'),
        kinds.length ? row('kinds', kinds.map((k) => this.kindName(k)).join(' · '), 'kinds') : null),
      r.description ? h('p', { class: 'desc', attrs: { dir: 'auto' } }, r.description) : null);
  }

  private editingForm(v: RfqView): boolean {
    const q = v.quote;
    const live = !!q && q.state === 'submitted';
    return !!v.can?.quote && (!live || this.editing);
  }

  /** The quote part: the form (no live quote, or "update"), else his quote as the server stored it, with update / withdraw. */
  private quoteBlock(v: RfqView, screen: RfqScreen): HTMLElement | null {
    const q = v.quote ?? null;
    if (quoting(screen) && this.editingForm(v)) {
      return h('div', { class: 'rfq-quote' },
        q && q.state === 'withdrawn' ? h('div', { class: 'banner info', attrs: { role: 'status', 'data-rfq-withdrawn': true } }, this.t('withdrawnBody')) : null,
        this.form(v));
    }
    if (!q || q.state === 'withdrawn') return null;
    const can = v.can;
    const box = h('section', { class: 'swc swq rfq-sent', attrs: { 'data-rfq-sent': q.state, 'data-rfq-version': q.version } },
      h('header', { class: 'swc-head' }, h('h2', { class: 'swc-title' }, this.t(screen === 'open' || screen === 'declined' ? 'sentTitle' : 'yourQuote'))),
      quoting(screen) ? h('p', { class: 'swc-note' }, this.t('sentBody')) : null,
      h('p', { class: 'swc-muted' }, this.t('sentAt', { when: this.when(q.submitted_at), n: q.version })),
      this.summary(q),
      screen === 'awarded' && q.approved ? this.approvedPart(q) : null);
    if (quoting(screen) && (can?.quote || can?.withdraw)) {
      if (this.withdrawOpen) {
        box.appendChild(h('div', { class: 'swc-card rfq-confirm', attrs: { 'data-rfq-withdraw-confirm': true } },
          h('p', { class: 'swc-note' }, this.t('withdrawQ')),
          h('div', { class: 'swc-row swc-actions' },
            h('button', { class: 'swc-btn swc-primary', attrs: { type: 'button', disabled: this.busy, 'data-rfq-withdraw-yes': true }, on: { click: () => void this.withdraw() } }, this.t('withdraw')),
            h('button', { class: 'swc-btn', attrs: { type: 'button' }, on: { click: () => { this.withdrawOpen = false; this.render(); } } }, this.t('cancel')))));
      } else {
        box.appendChild(h('div', { class: 'swc-row swc-actions' },
          can?.quote ? h('button', { class: 'swc-btn swc-primary', attrs: { type: 'button', 'data-rfq-edit': true },
            on: { click: () => { this.editing = true; this.draft = null; this.showErrors = false; this.render(); } } }, this.t('edit')) : null,
          can?.withdraw ? h('button', { class: 'swc-btn', attrs: { type: 'button', 'data-rfq-withdraw': true }, on: { click: () => { this.withdrawOpen = true; this.render(); } } }, this.t('withdraw')) : null));
      }
    }
    return box;
  }

  /** His quote with the SERVER's amounts (lines, net, VAT, total), dates, validity, his number and note. */
  private summary(q: RfqQuote): HTMLElement {
    const wrap = h('div', { class: 'swq-summary', attrs: { 'data-rfq-summary': true } });
    const list = h('ul', { class: 'swc-rev-lines' });
    for (const ln of q.lines) {
      list.appendChild(h('li', { class: 'swc-rev-line' },
        h('span', { class: 'swc-rev-what', attrs: { dir: 'auto' } }, ln.description ? `${this.kindName(ln.kind)} - ${ln.description}` : this.kindName(ln.kind)),
        h('span', { class: 'swc-amount', attrs: { dir: 'ltr' } }, this.money(ln.total_minor, q.currency))));
    }
    wrap.appendChild(list);
    const row = (label: string, minor: number, cls = '', attr = '') => h('div', { class: `swc-total-row ${cls}`.trim(), attrs: attr ? { [attr]: String(minor) } : {} },
      h('span', null, label), h('span', { class: 'swc-amount', attrs: { dir: 'ltr' } }, this.money(minor, q.currency)));
    if (q.vat_mode !== 'none') {
      wrap.appendChild(row(this.c('net'), q.net_minor));
      wrap.appendChild(row(this.c('vat', { rate: formatRate(q.vat_rate_bp) }), q.vat_minor));
    }
    wrap.appendChild(row(this.c('total'), q.total_minor, 'swc-grand', 'data-rfq-total'));
    const facts: (HTMLElement | null)[] = [
      q.work_from || q.work_to ? h('div', { class: 'rfq-fact' }, h('span', { class: 'lbl' }, this.t('work')),
        h('span', { class: 'val' }, [q.work_from ? this.day(q.work_from) : '', q.work_to ? this.day(q.work_to) : ''].filter(Boolean).join(' – '))) : null,
      q.in_window === false ? h('p', { class: 'swc-note swc-warn', attrs: { 'data-rfq-out-window': true } }, this.t('outWindow')) : null,
      q.valid_until ? h('div', { class: 'rfq-fact' }, h('span', { class: 'lbl' }, this.t('valid')), h('span', { class: 'val' }, this.day(q.valid_until))) : null,
      q.vendor_ref ? h('div', { class: 'rfq-fact' }, h('span', { class: 'lbl' }, this.t('vendorRef')), h('span', { class: 'val', attrs: { dir: 'auto' } }, q.vendor_ref)) : null,
      q.note ? h('p', { class: 'swc-muted rfq-note', attrs: { dir: 'auto' } }, q.note) : null,
    ];
    for (const f of facts) if (f) wrap.appendChild(f);
    return wrap;
  }

  /** "Selected": the part of HIS quote that was approved (its lines and the approved figures). */
  private approvedPart(q: RfqQuote): HTMLElement {
    const a = q.approved!;
    const box = h('div', { class: 'swc-card rfq-approved', attrs: { 'data-rfq-approved': String(a.total_minor) } }, h('h3', { class: 'swc-sub' }, this.t('approvedPart')));
    const list = h('ul', { class: 'swc-rev-lines' });
    for (const ln of q.lines.filter((l) => a.line_indexes.includes(l.index))) {
      list.appendChild(h('li', { class: 'swc-rev-line' }, h('span', { class: 'swc-rev-what', attrs: { dir: 'auto' } }, ln.description ? `${this.kindName(ln.kind)} - ${ln.description}` : this.kindName(ln.kind)),
        h('span', { class: 'swc-amount', attrs: { dir: 'ltr' } }, this.money(ln.total_minor, q.currency))));
    }
    box.appendChild(list);
    box.appendChild(h('div', { class: 'swc-total-row swc-grand' }, h('span', null, this.c('total')), h('span', { class: 'swc-amount', attrs: { dir: 'ltr' } }, this.money(a.total_minor, q.currency))));
    return box;
  }

  // ---------------------------------------------------------------- the form

  private form(v: RfqView): HTMLElement {
    const d = this.formDraft();
    const s = rfqSettings(v);
    const kinds = rfqKinds(v);
    const live = v.quote && v.quote.state === 'submitted';
    const f = h('section', { class: 'swc swq rfq-form', attrs: { 'data-rfq-form': true } },
      h('header', { class: 'swc-head' }, h('h2', { class: 'swc-title' }, this.t('formTitle'))));
    const currencies = s?.currencies ?? ['ILS'];
    if (currencies.length > 1) {
      const sel = h('select', { class: 'swc-input', attrs: { 'aria-label': this.c('currency'), 'data-rfq-currency': true },
        on: { change: (e) => { d.form.currency = (e.target as HTMLSelectElement).value; this.keep(); this.paintFigures(); } } });
      for (const cur of currencies) sel.appendChild(h('option', { attrs: { value: cur, selected: cur === d.form.currency } }, cur));
      f.appendChild(h('label', { class: 'swc-field' }, h('span', { class: 'swc-label' }, this.c('currency')), sel));
    }
    if (s?.vat.exempt) f.appendChild(h('p', { class: 'swc-muted', attrs: { 'data-rfq-vat': 'none' } }, this.c('vat_none')));
    else {
      const seg = h('div', { class: 'swc-seg', attrs: { role: 'radiogroup', 'data-rfq-vat': d.form.include_vat ? 'included' : 'excluded' } });
      for (const include of [true, false]) {
        seg.appendChild(h('button', { class: 'swc-seg-btn', attrs: { type: 'button', role: 'radio', 'aria-checked': String(d.form.include_vat === include), 'data-rfq-vat-choice': include ? 'included' : 'excluded' },
          on: { click: () => { d.form.include_vat = include; this.keep(); this.render(); } } }, this.c(include ? 'vat_included' : 'vat_excluded')));
      }
      f.appendChild(seg);
    }
    f.appendChild(h('h3', { class: 'swc-sub' }, this.c('lines_title')));
    this.linesHost = h('div', { class: 'swc-lines' });
    d.form.lines.forEach((ln, i) => this.linesHost!.appendChild(this.lineRow(v, d, ln, i)));
    f.appendChild(this.linesHost);
    const add = h('div', { class: 'swc-row swc-add' });
    for (const k of kinds) {
      add.appendChild(h('button', { class: 'swc-btn swc-small', attrs: { type: 'button', 'data-rfq-add': k, 'aria-label': `${this.c('line_add')}: ${this.kindName(k)}` },
        on: { click: () => { if (d.form.lines.length >= (s?.limits.lines ?? 30)) return; d.form.lines.push(newLine(k, s)); this.keep(); this.render(); } } }, `+ ${this.kindName(k)}`));
    }
    f.appendChild(add);
    this.figuresHost = h('div', { class: 'swc-figures', attrs: { 'data-rfq-figures': true } });
    f.appendChild(this.figuresHost);

    const date = (key: 'workFrom' | 'workTo' | 'validUntil', label: RfqKey, attr: string, min?: string, max?: string) => {
      const input = h('input', { class: 'swc-input', attrs: { type: 'date', dir: 'ltr', [`data-rfq-${attr}`]: true, min: min ?? null, max: max ?? null },
        on: { change: (e) => { d[key] = (e.target as HTMLInputElement).value; this.keep(); this.paintWarn(); if (this.showErrors) this.paintErrors(); } } });
      input.value = d[key];
      return h('label', { class: 'swc-field swc-num' }, h('span', { class: 'swc-label' }, this.t(label)), input);
    };
    const today = isoToDay(new Date().toISOString(), v.time_zone);
    const yearOn = isoToDay(new Date(Date.now() + 366 * DAY_MS).toISOString(), v.time_zone);
    f.appendChild(h('h3', { class: 'swc-sub' }, this.t('work')));
    f.appendChild(h('div', { class: 'swc-nums' }, date('workFrom', 'from', 'work-from'), date('workTo', 'to', 'work-to')));
    this.warnHost = h('p', { class: 'swc-note swc-warn', attrs: { 'data-rfq-window-warn': true, role: 'status' } });
    f.appendChild(this.warnHost);
    f.appendChild(h('div', { class: 'swc-nums' }, date('validUntil', 'valid', 'valid-until', today, yearOn)));
    const ref = h('input', { class: 'swc-input', attrs: { type: 'text', dir: 'auto', maxlength: (v.form?.limits.vendor_ref ?? 40) * 2, 'data-rfq-vendor-ref': true },
      on: { input: (e) => { d.form.vendor_ref = (e.target as HTMLInputElement).value; this.keep(); if (this.showErrors) this.paintErrors(); } } });
    ref.value = d.form.vendor_ref;
    f.appendChild(h('label', { class: 'swc-field' }, h('span', { class: 'swc-label' }, `${this.t('vendorRef')} ${this.c('optional')}`), ref));
    const notes = h('textarea', { class: 'swc-input swc-area', attrs: { dir: 'auto', maxlength: (v.form?.limits.note ?? 1000) * 2, 'data-rfq-note': true },
      on: { input: (e) => { d.form.notes = (e.target as HTMLTextAreaElement).value; this.keep(); if (this.showErrors) this.paintErrors(); } } });
    notes.value = d.form.notes;
    f.appendChild(h('label', { class: 'swc-field' }, h('span', { class: 'swc-label' }, `${this.c('notes')} ${this.c('optional')}`), notes));
    const pay = this.terms ? this.terms.payEditor(this.termsHost(), d, v) : null; // CR-RFQ-PAYMENT-SCHEDULE: only when the installation offers it (`form.payment`)
    if (pay) f.appendChild(pay);
    // RFQQUESTIONS: a question has its own field (the manager sees it as a question waiting for him, not hidden in the notes)
    const qa = h('textarea', { class: 'swc-input swc-area', attrs: { dir: 'auto', maxlength: v.form?.limits.message ?? 2000, 'data-rfq-question': true },
      on: { input: (e) => { d.question = (e.target as HTMLTextAreaElement).value; this.keep(); } } });
    qa.value = d.question ?? '';
    if (v.can?.ask) f.appendChild(h('label', { class: 'swc-field' }, h('span', { class: 'swc-label' }, `${this.t('qField')} ${this.c('optional')}`), qa,
      h('span', { class: 'swc-muted swc-small-text' }, this.t('qFieldHint'))));
    this.errorHost = h('p', { class: 'swc-error', attrs: { role: 'alert', 'data-rfq-error': true } });
    this.errorHost.hidden = true;
    f.appendChild(this.errorHost);
    f.appendChild(h('div', { class: 'swc-row swc-actions' },
      h('button', { class: 'swc-btn swc-primary', attrs: { type: 'button', disabled: this.busy, 'data-rfq-send': true }, on: { click: () => void this.submitQuote() } },
        this.busy ? this.t('sending') : this.t(live ? 'resend' : 'send')),
      live ? h('button', { class: 'swc-btn', attrs: { type: 'button', 'data-rfq-cancel-edit': true },
        on: { click: () => { this.editing = false; this.draft = null; this.showErrors = false; this.keep(); this.render(); } } }, this.t('cancelEdit')) : null));
    return f;
  }

  private lineRow(v: RfqView, d: RfqDraft, ln: LineDraft, i: number): HTMLElement {
    const s = rfqSettings(v);
    const kinds = rfqKinds(v);
    const sel = h('select', { class: 'swc-input swc-kind', attrs: { 'aria-label': this.c('line_kind'), 'data-rfq-kind': true },
      on: { change: (e) => { const next = newLine((e.target as HTMLSelectElement).value as LineKind, s, ln.key); next.description = ln.description; d.form.lines[i] = next; this.keep(); this.render(); } } });
    for (const k of kinds) sel.appendChild(h('option', { attrs: { value: k, selected: k === ln.kind } }, this.kindName(k)));
    const num = (key: 'hours' | 'rate' | 'quantity' | 'unit_price' | 'amount', label: ClaimTextKey) => {
      const input = h('input', { class: 'swc-input', attrs: { type: 'text', inputmode: 'decimal', autocomplete: 'off', dir: 'ltr', 'data-quote-field': key },
        on: { input: (e) => { ln[key] = (e.target as HTMLInputElement).value; this.keep(); this.paintFigures(); if (this.showErrors) this.paintErrors(); } } });
      input.value = ln[key];
      return h('label', { class: 'swc-field swc-num' }, h('span', { class: 'swc-label' }, this.c(label)), input);
    };
    const nums = h('div', { class: 'swc-nums' });
    if (ln.kind === 'labor') nums.append(num('hours', 'f_hours'), num('rate', 'f_rate'));
    else if (ln.kind === 'parts') nums.append(num('quantity', 'f_quantity'), num('unit_price', 'f_unit_price'));
    else nums.append(num('amount', 'f_amount'));
    const needDesc = ln.kind === 'parts' || ln.kind === 'other';
    const desc = h('input', { class: 'swc-input', attrs: { type: 'text', dir: 'auto', maxlength: (s?.limits.description ?? 120) * 2, 'data-quote-field': 'description' },
      on: { input: (e) => { ln.description = (e.target as HTMLInputElement).value; this.keep(); if (this.showErrors) this.paintErrors(); } } });
    desc.value = ln.description;
    return h('div', { class: 'swc-line', attrs: { 'data-rfq-line': ln.kind } },
      h('div', { class: 'swc-line-top' }, sel,
        h('span', { class: 'swc-amount swc-line-total', attrs: { dir: 'ltr', 'data-line': i } }),
        h('button', { class: 'swc-btn swc-icon', attrs: { type: 'button', 'aria-label': this.c('line_remove'), 'data-rfq-remove': i },
          on: { click: () => { d.form.lines.splice(i, 1); this.keep(); this.render(); } } }, '✕')),
      nums,
      h('label', { class: 'swc-field' }, h('span', { class: 'swc-label' }, needDesc ? this.c('f_description') : `${this.c('f_description')} ${this.c('optional')}`), desc));
  }

  /** The preview of the figures - for display only; the server computes the amounts that count. */
  private paintFigures(): void {
    const v = this.view;
    const d = this.draft;
    if (!v || !d) return;
    const s = rfqSettings(v);
    const fig = computeForm(d.form, s);
    for (const node of this.linesHost?.querySelectorAll<HTMLElement>('.swc-line-total') ?? []) {
      const val = fig.lines[Number(node.dataset.line)];
      node.textContent = val === null || val === undefined ? '' : this.money(val, d.form.currency);
    }
    const host = this.figuresHost;
    if (!host) return;
    host.replaceChildren();
    const row = (label: string, minor: number, cls = '') => host.appendChild(h('div', { class: `swc-total-row ${cls}`.trim() }, h('span', null, label),
      h('span', { class: 'swc-amount', attrs: { dir: 'ltr' } }, this.money(minor, d.form.currency))));
    if (fig.vatMode !== 'none') {
      row(this.c('net'), fig.net);
      row(this.c('vat', { rate: formatRate(fig.rateBp) }), fig.vat);
    }
    row(this.c('total'), fig.total, 'swc-grand');
    host.appendChild(h('p', { class: 'swc-muted swc-small-text' }, this.c('estimate_note')));
    this.paintWarn();
  }

  private paintWarn(): void {
    const v = this.view;
    const d = this.draft;
    if (!this.warnHost || !v || !d) return;
    const out = outsideWindow(d.workFrom, d.workTo, v.rfq?.work_from, v.rfq?.work_to, v.time_zone);
    this.warnHost.hidden = !out;
    this.warnHost.textContent = out ? this.t('outWindow') : '';
  }

  private paintErrors(): void {
    const v = this.view;
    const d = this.draft;
    if (!this.errorHost || !v || !d) return;
    let msg = '';
    if (this.showErrors) {
      const first = draftProblems(d, v, Date.now())[0];
      if (first) {
        if (first.code === 'kind_not_allowed') msg = this.t('r_e_kind_not_allowed');
        else if (first.field === 'valid_until') msg = this.t('r_e_valid_until');
        else if (first.field === 'work_to') msg = this.t('r_e_dates');
        else if (first.field.startsWith('payment')) msg = this.t('r_e_pay');
        else if (first.field === 'lines' && first.code === 'required') msg = this.c('e_lines_required');
        else msg = errorText(claimLang(this.lang), first.code);
      }
    }
    this.errorHost.hidden = !msg;
    this.errorHost.textContent = msg;
  }

  // ---------------------------------------------------------------- not interested, questions

  private declineBlock(v: RfqView): HTMLElement {
    if (!this.declineOpen) {
      return h('div', { class: 'center-row' }, h('button', { class: 'btn ghost', attrs: { type: 'button', 'data-rfq-decline': true },
        on: { click: () => { this.declineOpen = true; this.render(); } } }, this.t('decline')));
    }
    const input = h('input', { class: 'input', attrs: { type: 'text', dir: 'auto', maxlength: v.form?.limits.decline_reason ?? 200, 'aria-label': this.t('declineReason'), 'data-rfq-decline-reason': true },
      on: { input: (e) => { this.declineReason = (e.target as HTMLInputElement).value; } } });
    input.value = this.declineReason;
    return h('section', { class: 'card ret', attrs: { 'data-rfq-decline-box': true } },
      h('h3', null, this.t('decline')),
      h('p', { class: 'msg-body start' }, this.t('declineQ')),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, this.t('declineReason')), input),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', attrs: { type: 'button', disabled: this.busy, 'data-rfq-decline-yes': true }, on: { click: () => void this.decline() } }, this.t('confirm')),
        h('button', { class: 'btn', attrs: { type: 'button' }, on: { click: () => { this.declineOpen = false; this.render(); } } }, this.t('cancel'))));
  }

  /** The private thread: his questions and the organisation's answers (no names); a compose box while questions are allowed. */
  private threadCard(v: RfqView): HTMLElement | null {
    const items = v.messages ?? [];
    const canAsk = !!v.can?.ask;
    if (!items.length && !canAsk) return null;
    const list = h('ol', { class: 'timeline', attrs: { 'data-rfq-thread': items.length } });
    for (const m of items) {
      list.appendChild(h('li', { class: m.mine ? 'mine' : 'theirs', attrs: { 'data-rfq-msg': m.mine ? 'mine' : 'theirs' } },
        h('div', { class: 'meta' }, h('span', { class: 'who' }, this.t(m.mine ? 'you' : 'org')), h('span', { class: 'when' }, this.when(m.at)),
          m.mine && typeof m.answered === 'boolean' ? h('span', { class: `chip ${m.answered ? 'st-done' : 'st-waiting_part'}`, attrs: { 'data-rfq-q-state': m.answered ? 'answered' : 'waiting' } }, this.t(m.answered ? 'qAnswered' : 'qWaiting')) : null),
        h('div', { class: 'body', attrs: { dir: 'auto' } }, m.text)));
    }
    const card = h('section', { class: 'card', attrs: { 'data-rfq-thread-card': true } }, h('h2', null, this.t('thread')),
      items.length ? list : h('p', { class: 'muted small' }, this.t('threadEmpty')));
    if (canAsk) {
      const ta = h('textarea', { class: 'input note', attrs: { rows: 3, dir: 'auto', maxlength: v.form?.limits.message ?? 2000, placeholder: this.t('askPh'), 'aria-label': this.t('askPh'),
        'data-rfq-ask': true }, on: { input: (e) => { this.ask = (e.target as HTMLTextAreaElement).value; } } });
      ta.value = this.ask;
      card.appendChild(ta);
      card.appendChild(h('button', { class: 'btn block', attrs: { type: 'button', disabled: this.busy, 'data-rfq-ask-send': true }, on: { click: () => void this.sendQuestion() } },
        icon('send'), this.t('ask')));
    }
    return card;
  }
}

/** Mounts the RFQ mode into the page's root (main.ts calls it once the link is known to be an RFQ link). */
export function mountRfq(host: RfqHost): void {
  new RfqPage(host).start();
}
