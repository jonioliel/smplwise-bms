/**
 * CR-038 slice 4 - the handler page (spec 10.7): what an outside contact or vendor sees after tapping the link in a message. A
 * separate, small bundle (frontend/public-ticket.html -> smplwise_vms/www-public/), served ONLY by the public listener on its own
 * origin: no app shell, no router, no skins, no service worker, nothing shared with the main app (tests/unit-public-ticket.spec.ts
 * checks the imports and the size budget). Mobile first, one column, touch targets of 44 px, light / dark by the phone's setting.
 *
 * The token arrives in the URL FRAGMENT (`/t/#<token>`): it is read once, kept in memory and in this tab's sessionStorage (a reload
 * still works), the address bar is replaced by `/t/` and the token travels only in the `X-Ticket-Token` header. "סיום" forgets it.
 * The page loads the ticket on start and when the tab becomes visible again - no polling. Writes carry a client request id kept
 * with the draft until confirmed, so a retry on bad reception never applies an update twice.
 */
import './styles.css';
import { homePath } from './base';
import { brandMark } from './brand';
import { api, newRequestId, type ApiFailure, type Credentials, type TicketView, rawCall } from './api';
import { h, icon, img } from './dom';
import { mapBlock } from './map-block';
import { afterFailure, afterStep, codeMessage, EMPTY_DRAFT, linkKind, parseDraft, phaseOf, lineOf, partToggle, pickMode, planSend, primaryAction, statusChoices, statusLine, validSession,
  type Draft, type LinkKind, type Phase, type Step } from './state';
import { CATALOGUES, isLang, LANGS, preferredLang, RTL, text, type Key, type Lang } from './strings';
import { applyMode, nextChoice, prefersDark, resolveMode, saveChoice, saveServerMode, storedChoice, storedServerMode, type ThemeMode } from './theme';
import { etaFor, formatDate, formatWhen, isoToLocalInput, localInputToIso, zoneNote, type EtaChoice } from './time';

// TKRFQVP: an RFQ link keeps its own token / code session / quote draft (the RFQ chunk reads them through RfqHost)
const STORE = { token: 'arx.t.token', session: 'arx.t.session', lang: 'arx.t.lang', draft: 'arx.t.draft', rfq: 'arx.t.rfq', rsession: 'arx.t.rsession', rdraft: 'arx.t.rdraft' } as const;

function stored(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* a private tab without storage: memory only */
  }
}

interface ReturnForm { open: boolean; kind: 'not_mine' | 'cannot_handle'; reason: string; crid: string | null; error: string | null }

class Page {
  private root: HTMLElement;
  private creds: Credentials = { token: null, session: null };
  private filesEl: HTMLElement | null = null;
  private filesKey = '';
  // slice 9 (11A.2): the cost-claim step - a persistent host (the page re-renders its DOM; the step keeps its own state) and the
  // lazily loaded module (its chunk is fetched only when a claim exists)
  private claimHost: HTMLElement | null = null;
  private claimHandle: { refresh(): Promise<void>; destroy(): void } | null = null;
  private claimLoading = false;
  // TK257: the permanent quote / payment card (lazy chunk); it hosts the claim step in its payment part
  private costHandle: { element: HTMLElement; update(ctx: { status: string | null; claim: { status: string } | null }): void; refresh(): Promise<void>;
    ready: Promise<void>; quoteState(): string | null; destroy(): void } | null = null;
  private costLoading = false;
  // GRANTS3-295: the arrival step (lazy chunk, fetched only when the ticket answer says `arrival: true`)
  private arrivalHandle: { element: HTMLElement; refresh(): Promise<void>; setLang(l: Lang): void } | null = null;
  private arrivalLoading = false;
  private rid: string | null = null;
  private phase: Phase = 'loading';
  private view: TicketView | null = null;
  private lang: Lang = 'he';
  private chosenLang: Lang | null = null;
  private theme: ThemeMode = 'light';
  private banner: { key: string; tone: 'ok' | 'bad' | 'info'; n?: number } | null = null;
  private draft: Draft = { ...EMPTY_DRAFT, crids: {} };
  private busy = false;
  private etaOther = false;
  private ret: ReturnForm = { open: false, kind: 'not_mine', reason: '', crid: null, error: null };
  private returned: { number: number; kind: string } | null = null;
  private code = { sent: false, value: '', message: null as null | { key: string; n?: number } };
  private photos = new Map<string, string>();
  private uploading = 0;
  /** TKMAP1: the map picture's blob: URL (fetched once per view that says a picture exists) */
  private mapUrl: string | null = null;
  private mapAsked = false;
  /** TKRFQVP: the request-for-quotation mode (`#q.<token>` or a redeem answer of kind "rfq") hands the page to the lazy RFQ chunk */
  private mode: 'ticket' | 'rfq' = 'ticket';
  /** vendor-portal-leftovers: the item was opened from the portal list - the header offers "back to the list" (the portal session lives). */
  private fromPortal = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    const saved = stored(STORE.lang);
    if (isLang(saved)) this.chosenLang = saved;
    // before a ticket answers (an expired link, the redeem screen): the choice made here, else the browser's language
    this.lang = this.chosenLang ?? preferredLang(typeof navigator !== 'undefined' ? navigator.languages : null) ?? 'he';
    const boot = pickMode(window.location.hash, window.location.pathname, stored(STORE.token), stored(STORE.rfq));
    if (boot.fromFragment || boot.rid) {
      try {
        history.replaceState(null, '', homePath()); // the token never stays in the address bar, the history or a bookmark
      } catch {
        /* ignore */
      }
    }
    this.theme = resolveMode(storedChoice(), storedServerMode());
    applyMode(this.theme);
    this.draft = parseDraft(stored(STORE.draft));
    if (boot.mode === 'consent' && boot.token) {
      this.render(); // WA-CONSENT-LINK: the lazy consent chunk; the token stays in memory only
      import('./consent/consent-page').then((m) => m.mountConsent({ root: this.root, token: boot.token as string, lang: this.lang,
        setLang: (l) => store(STORE.lang, l), unavailable: () => { this.phase = 'unavailable'; this.render(); } })).catch(() => { this.phase = 'error'; this.render(); });
    } else if (boot.mode === 'document' && boot.token) {
      this.render(); // CR-VENDORQ-294: the lazy document chunk; the token stays in memory only
      import('./doc/doc-page').then((m) => m.mountDocument({ root: this.root, token: boot.token as string, lang: this.lang,
        setLang: (l) => store(STORE.lang, l), unavailable: () => { this.phase = 'unavailable'; this.render(); } })).catch(() => { this.phase = 'error'; this.render(); });
    } else if (boot.mode === 'rfq' && boot.token) {
      this.startRfq(boot.token);
    } else if (boot.token) {
      if (boot.fromFragment) this.forgetRfq(); // only one link is kept per tab
      this.setToken(boot.token);
      this.creds.session = validSession(stored(STORE.session));
      void this.load();
    } else if (boot.rid) {
      this.rid = boot.rid;
      this.phase = 'redeem';
      this.render();
    } else {
      this.tryPortal(); // VPORTAL: no link at all - the vendor portal when it is on, else the unavailable screen as before
    }
    document.addEventListener('visibilitychange', () => {
      if (this.mode === 'rfq') return; // the RFQ chunk reloads itself (the portal never holds a token: nothing reloads here)
      if (document.visibilityState === 'visible' && this.creds.token && ['ready', 'readonly', 'code', 'busy', 'error'].includes(this.phase)) void this.load();
    });
    window.addEventListener('online', () => {
      if (this.mode === 'ticket' && this.phase === 'ready' && this.hasDraft()) void this.send();
    });
  }

  // ---------------------------------------------------------------- state

  private setToken(token: string | null): void {
    this.creds.token = token;
    store(STORE.token, token);
  }

  private forget(): void {
    this.fromPortal = false;
    this.setToken(null);
    this.creds.session = null;
    store(STORE.session, null);
    store(STORE.draft, null);
    this.draft = { ...EMPTY_DRAFT, crids: {} };
    for (const url of this.photos.values()) URL.revokeObjectURL(url);
    this.photos.clear();
    if (this.mapUrl) URL.revokeObjectURL(this.mapUrl);
    this.mapUrl = null;
    this.mapAsked = false;
    this.forgetRfq();
  }

  /** TKRFQVP: forget the RFQ link of this tab (its token, code session and quote draft). */
  private forgetRfq(): void {
    store(STORE.rfq, null);
    store(STORE.rsession, null);
    store(STORE.rdraft, null);
  }

  /** TKRFQVP: the link is a request for quotation - the lazy RFQ chunk takes the page over (the ticket chunks are never fetched). */
  private startRfq(token: string): void {
    this.mode = 'rfq';
    this.setToken(null);
    store(STORE.session, null);
    if (stored(STORE.rfq) !== token) this.forgetRfq(); // another request's code session and draft never carry over
    store(STORE.rfq, token);
    this.phase = 'loading';
    this.render();
    void import('./rfq/rfq-page').then((m) => {
      m.mountRfq({
        root: this.root, token, chosenLang: this.chosenLang, fallbackLang: this.lang,
        stored: (key) => stored(key === 'session' ? STORE.rsession : STORE.rdraft),
        store: (key, value) => store(key === 'session' ? STORE.rsession : key === 'draft' ? STORE.rdraft : STORE.lang, value),
        forget: () => this.forget(),
      });
    }).catch(() => {
      this.phase = 'error';
      this.render();
    });
  }

  /**
   * VPORTAL: no link - the vendor portal (a lazy chunk). It asks the server first (`GET /t/api/portal/config`); while the portal is off
   * that is the uniform 404 and the chunk hands back the unavailable screen, exactly as before.
   */
  private tryPortal(): void {
    this.render(); // the boot phase is 'loading'
    const back = (): void => {
      this.phase = 'unavailable';
      this.render();
    };
    import('./portal/portal-page').then((m) => m.mountPortal({
      root: this.root, chosenLang: this.chosenLang, fallbackLang: this.lang, unavailable: back,
      setLang: (lang) => { this.chosenLang = lang; store(STORE.lang, lang); },
      openTicket: (token) => this.openFromPortal(token),
      openRfq: (token) => this.startRfq(token), // VPORTALRFQ: his own RFQ link - the existing RFQ page, its own code rules
    })).catch(back);
  }

  /** VPORTAL: the portal handed over one item's handler token - the ordinary handler page takes it (its own code / grace rules). */
  private openFromPortal(token: string): void {
    this.forget();
    this.fromPortal = true;
    this.setToken(token); // "סיום" ends at the finished screen as for any link; /support again shows the list while the session lives
    void this.load();
  }

  private saveDraft(): void {
    store(STORE.draft, JSON.stringify(this.draft));
  }

  private hasDraft(): boolean {
    return !!(this.draft.status || this.draft.note.trim() || this.draft.eta !== undefined);
  }

  private t(key: Key | string, vars: Record<string, string | number> = {}): string {
    return text(this.lang, key as Key, vars, this.view?.labels ?? null);
  }

  private when(iso: string | null | undefined): string {
    return formatWhen(iso, this.view?.time_zone ?? 'Asia/Jerusalem', this.lang);
  }

  private fail(e: ApiFailure): void {
    const next = afterFailure(e, this.phase);
    if (next.forget) this.forget();
    this.phase = next.phase;
    this.banner = next.message ? { key: next.message, tone: next.message === 'savedOffline' ? 'info' : 'bad' } : null;
    if (next.reload) void this.load(false);
    else this.render();
  }

  private async load(showLoading = true): Promise<void> {
    if (!this.creds.token) {
      this.phase = 'unavailable';
      this.render();
      return;
    }
    if (showLoading && !this.view) {
      this.phase = 'loading';
      this.render();
    }
    const r = await api.ticket(this.creds);
    if (!r.ok) {
      if (r.error.status === 404) this.view = null;
      this.fail(r.error);
      return;
    }
    this.view = r.data;
    if (r.data.arrival && this.arrivalHandle) void this.arrivalHandle.refresh(); // GRANTS3-295: the approval may have landed meanwhile
    if (r.data.theme) saveServerMode(r.data.theme);
    this.theme = resolveMode(storedChoice(), r.data.theme);
    applyMode(this.theme);
    this.lang = this.chosenLang ?? (isLang(r.data.lang) ? r.data.lang : 'he');
    this.phase = phaseOf(r.data);
    if (this.phase === 'code' && (r.data.code_locked_s ?? 0) > 0) this.code.message = { key: 'codeLocked', n: Math.ceil((r.data.code_locked_s ?? 60) / 60) };
    this.render();
    void this.loadPhotos();
    void this.loadMap();
  }

  /** TKMAP1: the map picture, once (a reload of the view keeps it; an element that left the map drops it). */
  private async loadMap(): Promise<void> {
    const block = mapBlock(this.view?.map_element);
    if (!block?.image) {
      if (this.mapUrl) URL.revokeObjectURL(this.mapUrl);
      this.mapUrl = null;
      this.mapAsked = false;
      return;
    }
    if (this.mapAsked) return;
    this.mapAsked = true;
    const blob = await api.mapBlob(this.creds);
    if (!blob) {
      this.mapAsked = false;
      return;
    }
    this.mapUrl = URL.createObjectURL(blob);
    this.render();
  }

  /** TKMAP1: "location on the map" - the stored text, and the server's 2D picture when there is one (nothing interactive). */
  private mapCard(v: TicketView): HTMLElement | null {
    const block = mapBlock(v.map_element);
    if (!block) return null;
    return h('section', { class: 'card map-card', attrs: { 'data-map-card': block.image ? 'image' : 'text' } }, h('h2', null, this.t('mapTitle')),
      h('div', { class: 'where' }, icon('pin'), h('span', { attrs: { dir: 'auto', 'data-map-line': true } }, block.line)),
      block.image
        ? (this.mapUrl ? h('figure', { class: 'map-figure' }, img(this.mapUrl, this.t('mapAlt'), 'map-img'))
          : h('div', { class: 'map-figure empty', attrs: { 'aria-hidden': 'true' } }, icon('image')))
        : h('p', { class: 'muted small', attrs: { 'data-map-text-only': true } }, this.t('mapNoImage')));
  }

  private async loadPhotos(): Promise<void> {
    const want = (this.view?.photos ?? []).filter((p) => !this.photos.has(p.id));
    for (const p of want) {
      const blob = await api.photoBlob(this.creds, p.id);
      if (blob) this.photos.set(p.id, URL.createObjectURL(blob));
    }
    if (want.length) this.render();
  }

  // ---------------------------------------------------------------- actions

  private async redeem(): Promise<void> {
    if (!this.rid || this.busy) return;
    this.busy = true;
    this.render();
    const r = await api.redeem(this.rid);
    this.busy = false;
    if (!r.ok) {
      this.fail(r.error);
      return;
    }
    this.rid = null;
    if (r.data.kind === 'rfq') {
      this.startRfq(r.data.token); // contract 15.1: the e-mail form of an RFQ link
      return;
    }
    this.setToken(r.data.token);
    await this.load();
  }

  private async send(): Promise<void> {
    const v = this.view;
    if (!v || this.busy) return;
    const { steps, draft } = planSend(this.draft, v, newRequestId);
    this.draft = draft;
    this.saveDraft(); // the request ids are kept BEFORE anything is sent: a retry is the same request
    if (!steps.length) {
      this.banner = { key: 'nothingToSend', tone: 'info' };
      this.render();
      return;
    }
    this.busy = true;
    this.banner = null;
    this.render();
    for (const step of steps) {
      const r = await this.run(step);
      if (!r.ok) {
        this.busy = false;
        this.fail(r.error);
        return;
      }
      this.draft = afterStep(this.draft, step);
      this.saveDraft();
    }
    this.busy = false;
    this.etaOther = false;
    this.banner = { key: 'sent', tone: 'ok' };
    await this.load(false);
  }

  private run(step: Step) {
    if (step.kind === 'status') return api.status(this.creds, step.status, step.note, step.crid);
    if (step.kind === 'note') return api.note(this.creds, step.text, step.crid, step.ask === true);
    return api.eta(this.creds, step.eta, step.crid);
  }

  private async upload(file: File): Promise<void> {
    if (!this.view) return;
    this.uploading += 1;
    this.banner = { key: 'photoUploading', tone: 'info' };
    this.render();
    const r = await api.photo(this.creds, file, newRequestId());
    this.uploading -= 1;
    if (!r.ok) {
      this.fail(r.error);
      return;
    }
    this.banner = { key: 'photoAdded', tone: 'ok' };
    await this.load(false);
  }

  private async giveBack(): Promise<void> {
    const reason = this.ret.reason.trim();
    if (!reason) {
      this.ret.error = 'returnReasonRequired';
      this.render();
      return;
    }
    if (this.busy) return;
    this.ret.crid = this.ret.crid ?? newRequestId();
    this.busy = true;
    this.render();
    const r = await api.giveBack(this.creds, this.ret.kind, reason, this.ret.crid);
    this.busy = false;
    if (!r.ok) {
      this.fail(r.error);
      return;
    }
    // the link is already dead: the confirmation comes from this answer, never from another request (spec 10.7)
    this.returned = { number: r.data.number, kind: r.data.kind };
    this.forget();
    this.phase = 'returned';
    this.render();
  }

  private async codeSend(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    const r = await api.codeSend(this.creds);
    this.busy = false;
    if (!r.ok) {
      this.code.message = codeMessage(r.error);
      this.render();
      return;
    }
    // the code's lifetime is a setting (slice 7, code.ttl_min): the server says it in expires_in_s
    this.code = { sent: true, value: '', message: { key: r.data.channel === 'whatsapp' ? 'codeSentWa' : 'codeSent', n: Math.max(1, Math.round((r.data.expires_in_s || 600) / 60)) } };
    this.render();
  }

  private async codeVerify(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    const r = await api.codeVerify(this.creds, this.code.value);
    this.busy = false;
    if (!r.ok) {
      this.code.message = codeMessage(r.error);
      this.render();
      return;
    }
    this.creds.session = r.data.session;
    store(STORE.session, r.data.session);
    this.code = { sent: false, value: '', message: null };
    await this.load();
  }

  private finish(): void {
    this.forget();
    this.view = null;
    this.phase = 'finished';
    this.render();
  }

  private setLang(lang: Lang): void {
    this.chosenLang = lang;
    this.lang = lang;
    store(STORE.lang, lang);
    this.render();
  }

  // ---------------------------------------------------------------- rendering

  private render(): void {
    const dir = RTL.has(this.lang) ? 'rtl' : 'ltr';
    document.documentElement.lang = this.lang;
    document.documentElement.dir = dir;
    const v = this.view;
    document.title = v?.organization || this.t('pageTitle');
    const body = this.body();
    this.root.replaceChildren(body);
  }

  private body(): HTMLElement {
    switch (this.phase) {
      case 'loading':
        return this.screen(null, [h('div', { class: 'spinner', attrs: { role: 'status', 'aria-label': this.t('loading') } })]);
      case 'redeem':
        return this.screen(null, [
          h('h1', { class: 'msg-title' }, this.t('redeemTitle')),
          h('p', { class: 'msg-body' }, this.t('redeemBody')),
          h('button', { class: 'btn primary block', attrs: { type: 'button', disabled: this.busy, 'data-redeem': true }, on: { click: () => void this.redeem() } },
            this.t('redeemButton')),
        ]);
      case 'unavailable':
        return this.message('unavailableTitle', 'unavailableBody', 'lock');
      case 'busy':
        return this.message('busyTitle', 'busyBody', 'clock', true);
      case 'error':
        return this.message('errorTitle', 'errorBody', 'clock', true);
      case 'finished':
        return this.message('finishedTitle', 'finishedBody', 'out');
      case 'returned':
        return this.screen(null, [
          h('div', { class: 'done-mark' }, icon('back')),
          h('h1', { class: 'msg-title', attrs: { 'data-returned': true } }, this.t('returnedTitle')),
          this.returned ? h('p', { class: 'msg-sub' }, this.t('number', { number: this.returned.number })) : null,
          h('p', { class: 'msg-body' }, this.t('returnedBody')),
        ]);
      case 'code':
        return this.codeScreen();
      default:
        return this.ticketScreen();
    }
  }

  private header(): HTMLElement {
    const v = this.view;
    const org = v?.organization || '';
    return h('header', { class: 'top' },
      h('div', { class: 'brand' },
        brandMark(org, v?.logo), // VPORTAL: the logo when one is set, else the initial
        h('div', { class: 'who' },
          org ? h('div', { class: 'org' }, org) : null,
          v ? h('div', { class: 'sub' }, this.t('number', { number: v.number }), v.department ? ` · ${v.department}` : '') : null)),
      h('div', { class: 'tools' }, this.fromPortal ? this.backToListButton() : null, this.themeToggle(), this.langPicker()));
  }

  /** vendor-portal-leftovers: back to the portal list; the item's token is forgotten like any other hand-off, the portal re-reads its own session. */
  private backToListButton(): HTMLElement {
    return h('button', { class: 'icon-btn back-btn', attrs: { type: 'button', 'data-portal-back': true, 'aria-label': this.t('backToList') },
      on: { click: () => { this.forget(); this.tryPortal(); } } }, this.t('backToList'));
  }

  /** TK259: one tap flips light / dark and is remembered in this browser (theme.ts). */
  private themeToggle(): HTMLElement {
    const dark = this.theme === 'dark' || (this.theme === 'auto' && prefersDark());
    return h('button', { class: 'icon-btn', attrs: { type: 'button', 'data-theme-toggle': dark ? 'dark' : 'light', 'aria-label': this.t(dark ? 'themeToLight' : 'themeToDark') },
      on: { click: () => { const c = nextChoice(this.theme, prefersDark()); saveChoice(c); this.theme = c; applyMode(c); this.render(); } } }, icon(dark ? 'sun' : 'moon'));
  }

  private langPicker(): HTMLElement {
    const sel = h('select', { class: 'lang', attrs: { 'aria-label': this.t('language'), 'data-lang-picker': true },
      on: { change: (e) => { const value = (e.target as HTMLSelectElement).value; if (isLang(value)) this.setLang(value); } } });
    for (const l of LANGS) {
      const o = h('option', { attrs: { value: l, selected: l === this.lang, lang: l } }, CATALOGUES[l].langName);
      sel.appendChild(o);
    }
    return sel;
  }

  private screen(head: HTMLElement | null, content: (Node | null)[]): HTMLElement {
    return h('div', { class: 'page' }, head, h('main', { class: 'center' }, h('section', { class: 'card msg' }, ...content)));
  }

  private message(title: Key, bodyKey: Key, ic: string, retry = false): HTMLElement {
    return this.screen(this.view ? this.header() : null, [
      h('div', { class: 'msg-icon' }, icon(ic)),
      h('h1', { class: 'msg-title', attrs: { 'data-state-title': title } }, this.t(title)),
      h('p', { class: 'msg-body' }, this.t(bodyKey)),
      retry && this.creds.token ? h('button', { class: 'btn block', attrs: { type: 'button' }, on: { click: () => void this.load() } }, this.t('retry')) : null,
    ]);
  }

  private bannerEl(): HTMLElement | null {
    const b = this.banner;
    if (!b) return null;
    return h('div', { class: `banner ${b.tone}`, attrs: { role: b.tone === 'bad' ? 'alert' : 'status', 'data-banner': b.key } }, this.t(b.key, { n: b.n ?? '' }));
  }

  private codeScreen(): HTMLElement {
    const v = this.view;
    const m = this.code.message;
    const input = h('input', { class: 'input code', attrs: { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 9, 'aria-label': this.t('codeInput'),
      'data-code-input': true, dir: 'ltr' }, on: { input: (e) => { this.code.value = (e.target as HTMLInputElement).value; } } });
    input.value = this.code.value;
    return h('div', { class: 'page' }, this.header(), h('main', { class: 'col' },
      h('section', { class: 'card code' },
        h('div', { class: 'msg-icon' }, icon('lock')),
        h('h1', { class: 'msg-title' }, this.t('codeTitle')),
        h('p', { class: 'msg-body' }, this.t('codeBody')),
        v ? h('p', { class: 'msg-sub' }, `${this.t('number', { number: v.number })}${v.department ? ` · ${v.department}` : ''}`) : null,
        m ? h('div', { class: `banner ${m.key.startsWith('codeSent') ? 'ok' : 'bad'}`, attrs: { role: 'status', 'data-code-message': m.key } }, this.t(m.key, { n: m.n ?? '' })) : null,
        this.code.sent ? h('div', { class: 'row' }, input,
          h('button', { class: 'btn primary', attrs: { type: 'button', disabled: this.busy, 'data-code-verify': true }, on: { click: () => void this.codeVerify() } }, this.t('codeVerify'))) : null,
        h('button', { class: `btn ${this.code.sent ? 'ghost' : 'primary'} block`, attrs: { type: 'button', disabled: this.busy, 'data-code-send': true },
          on: { click: () => void this.codeSend() } }, this.t(this.code.sent ? 'codeResend' : 'codeSend')),
      ),
      this.footer()));
  }

  /**
   * TKUI5: ONE component, the layout chosen by the link's kind (state.ts linkKind). First screen: organisation (top bar), number + title,
   * place, ONE status line, ONE big primary button (sticky at the bottom). Below: numbered cards - status, when, what was done, photos,
   * costs (vendor) or the device history (staff), updates. A staff link has no cost card and no claim surface at all (the cost chunk is
   * never even fetched).
   */
  private ticketScreen(): HTMLElement {
    const v = this.view;
    if (!v) return this.message('errorTitle', 'errorBody', 'clock', true);
    const readOnly = this.phase === 'readonly';
    const kind = linkKind(v);
    const writable = !readOnly && !!v.actions;
    return h('div', { class: `page kind-${kind}`, attrs: { 'data-kind': kind } }, this.header(), h('main', { class: 'col' },
      this.bannerEl(),
      readOnly && !v.claim_mode ? h('section', { class: 'card closed', attrs: { 'data-readonly': true } },
        h('div', { class: 'msg-icon ok' }, icon('done')),
        h('h1', { class: 'msg-title' }, this.t('closedTitle')),
        v.read_only_until ? h('p', { class: 'msg-body' }, this.t('closedBody', { when: this.when(v.read_only_until) })) : null) : null,
      this.hero(v, kind),
      v.claim_mode ? null : this.mapCard(v),
      v.claim_mode ? null : this.rfqFiles(v),
      v.arrival && !readOnly && kind === 'vendor' ? this.arrivalBlock(v) : null,
      v.claim_mode ? this.costBlock(v) : null,
      writable ? this.statusCard(v) : null,
      writable ? this.etaCard(v) : null,
      writable ? this.noteCard(v) : null,
      writable ? this.photosCard(v) : null,
      v.claim_mode ? null : kind === 'staff' ? this.historyCard(v) : this.costBlock(v),
      v.claim_mode ? null : this.timelineCard(v),
      writable && v.actions?.return ? this.returnBlock() : null),
    this.primaryBar(v, kind),
    this.footer());
  }

  /** GRANTS3-295: the arrival step's card, mounted once from its lazy chunk and refreshed when the ticket reloads. */
  private arrivalBlock(v: TicketView): HTMLElement | null {
    if (this.arrivalHandle) {
      this.arrivalHandle.setLang(this.lang);
      return this.arrivalHandle.element;
    }
    if (!this.arrivalLoading) {
      this.arrivalLoading = true;
      void import('./arrival/arrival-card').then((m) => {
        this.arrivalHandle = m.mountArrival({ fetchJson: (path, init) => rawCall(this.creds, init?.method ?? 'GET', path, init?.body), lang: this.lang,
          zone: v.time_zone, newRequestId });
        this.render();
      }).catch(() => { this.arrivalLoading = false; });
    }
    return null;
  }

  /** RFQATT: the request files a work order referenced - the lazy `rfq-files` chunk renders them (fetched only when there are some). */
  private rfqFiles(v: TicketView): HTMLElement | null {
    const files = v.rfq_files ?? [];
    const key = files.map((f) => f.id).join() + this.lang;
    if (!files.length) return null;
    if (this.filesEl && this.filesKey === key) return this.filesEl; // kept across renders: the thumbnails are fetched once
    const slot = h('div', { attrs: { 'data-rfq-files-slot': true } });
    this.filesEl = slot;
    this.filesKey = key;
    void import('./rfq/rfq-files').then((m) => {
      const card = m.filesCard(files, this.creds, 'ticket', this.lang);
      if (this.filesEl === slot) this.filesEl = card;
      slot.replaceWith(card);
    }).catch(() => slot.remove());
    return slot;
  }

  /** The ONE status line, in the vendor's words (state.ts statusLine); `data-status` carries the ticket's status for tests and tooling. */
  private statusLineEl(v: TicketView): HTMLElement {
    const l = statusLine(v, this.costHandle?.quoteState() ?? null);
    return h('div', { class: `statusline ${l.tone}`, attrs: { 'data-statusline': true, 'data-status': v.status ?? null, 'aria-live': 'polite' } },
      icon(l.icon), h('span', null, this.t(l.key)));
  }

  /**
   * The ONE big button (state.ts primaryAction): confirm receipt, correct the quote, send the payment request, or send the update. Always
   * the same place (sticky at the bottom), always full width, 56 px. A page that cannot be written has none.
   */
  private primaryBar(v: TicketView, kind: LinkKind): HTMLElement | null {
    const p = primaryAction(v, kind, this.hasDraft(), this.costHandle?.quoteState() ?? null);
    if (p === 'none') return null;
    const key: Key = p === 'ack' ? 'btn_ack' : p === 'quote_fix' ? 'btn_quote_fix' : p === 'demand' ? 'btn_demand' : this.busy ? 'sending' : 'send';
    const ic = p === 'ack' ? 'check' : p === 'send' ? 'send' : 'coin';
    const attrs: Record<string, string | boolean> = { type: 'button', disabled: this.busy && (p === 'send' || p === 'ack'), 'data-primary': p };
    if (p === 'send') attrs['data-send'] = true;
    if (p === 'ack') attrs['data-ack'] = true;
    const click = () => {
      if (p === 'ack') {
        this.draft = { ...this.draft, status: 'acknowledged' };
        this.saveDraft();
        void this.send();
      } else if (p === 'send') void this.send();
      else this.scrollTo(p === 'quote_fix' ? '[data-quote-part]' : '[data-claim-host]');
    };
    return h('div', { class: 'bar', attrs: { 'data-bar': p } },
      h('button', { class: 'btn primary block', attrs, on: { click } }, icon(ic), this.t(key)));
  }

  /** Brings a part of the page into view (no smooth scroll under reduced motion) and puts the keyboard on its first field. */
  private scrollTo(selector: string): void {
    const target = this.root.querySelector<HTMLElement>(selector);
    if (!target) return;
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    (target.querySelector<HTMLElement>('input, textarea') ?? target.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
  }

  /** Replaces the status line and the primary button in place (the quote's state arrives after the first draw; a note changes the primary). */
  private syncChrome(): void {
    const v = this.view;
    if (!v || !['ready', 'readonly'].includes(this.phase)) return;
    const line = this.root.querySelector('[data-statusline]');
    if (line) line.replaceWith(this.statusLineEl(v));
    const bar = this.root.querySelector<HTMLElement>('[data-bar]');
    const next = this.primaryBar(v, linkKind(v));
    if (bar && next && bar.dataset.bar === next.dataset.bar && !this.busy) return;
    if (bar && next) bar.replaceWith(next);
    else if (bar) bar.remove();
    else if (next) this.root.querySelector('.foot')?.before(next);
  }

  /**
   * TK257: the quote / payment card, on the page from the first moment (the claim step lives inside it once a claim exists). In claim mode
   * (the page no longer serves) it is the bare claim step, as before. Vendor kind only.
   */
  private costBlock(v: TicketView): HTMLElement | null {
    if (v.claim_mode) return this.claimBlock(v);
    if (!this.claimHost) this.claimHost = h('div', { class: 'claim-host', attrs: { 'data-claim-host': true } });
    const ctx = { status: v.status ?? null, claim: v.claim ? { status: v.claim.status } : null };
    if (this.costHandle) {
      this.costHandle.update(ctx);
    } else if (!this.costLoading) {
      this.costLoading = true;
      const slot = this.claimHost;
      void import('./claim/quote-card').then((m) => {
        this.costHandle = m.mountCostCard({
          fetchJson: (path, init) => rawCall(this.creds, init?.method ?? 'GET', path, init?.body),
          lang: this.lang, dir: v.dir, labels: v.labels, demandSlot: slot, onCodeRequired: () => void this.load(),
          onState: () => this.syncChrome(),
        });
        this.costHandle.update(ctx);
        this.render();
      }).catch(() => {
        this.costLoading = false;
      });
    }
    if (v.claim) this.claimBlock(v);
    return this.costHandle?.element ?? null;
  }

  /** Slice 9: the claim step under the ticket card once a claim exists (or in claim mode); mounted once, refreshed on reloads. */
  private claimBlock(v: TicketView): HTMLElement | null {
    if (!v.claim && !v.claim_mode) return null;
    if (!this.claimHost) {
      this.claimHost = h('div', { class: 'claim-host', attrs: { 'data-claim-host': true } });
    }
    if (this.claimHandle) {
      void this.claimHandle.refresh();
    } else if (!this.claimLoading) {
      this.claimLoading = true;
      const host = this.claimHost;
      void Promise.all([import('./claim/claim-step'), this.costHandle ? this.costHandle.ready : Promise.resolve()]).then(([m]) => {
        this.claimHandle = m.mountClaimStep(host, {
          embedded: !v.claim_mode,
          fetchJson: (path, init) => rawCall(this.creds, init?.method ?? 'GET', path, init?.body),
          uploadFile: (path, form) => rawCall(this.creds, 'POST', path, undefined, form),
          lang: this.lang, dir: v.dir, labels: v.labels, number: v.number, timeZone: v.time_zone,
          onCodeRequired: () => void this.load(),
          onDone: () => void this.load(false),
        });
      }).catch(() => {
        this.claimLoading = false;
      });
    }
    return this.claimHost;
  }

  /** The first card: number and priority, the title, the place, the one status line, the description, who sent it (and, for a vendor, the folded device history). */
  private hero(v: TicketView, kind: LinkKind): HTMLElement {
    const prio = v.priority ? (this.lang === 'he' && v.priority.name ? v.priority.name : this.t(`priority_${v.priority.key}`)) : '';
    const place = (v.place_text ?? '').trim();
    const location = (v.location_text ?? '').trim(); // CR-ORG-LOCATIONS: the organisation location the request names
    const device = (v.device_name ?? '').trim();
    return h('section', { class: 'card hero', attrs: { 'data-ticket': v.number } },
      h('div', { class: 'chips' },
        h('span', { class: 'chip num-chip' }, this.t('number', { number: v.number })),
        prio ? h('span', { class: `chip pr-${v.priority?.key ?? ''}` }, prio) : null,
        h('span', { class: 'spacer' }),
        v.created_at ? h('span', { class: 'muted small' }, this.t('openedAt', { when: formatDate(v.created_at, v.time_zone, this.lang) })) : null),
      // the ticket's own words keep their own direction (a Hebrew title on a Russian page reads right to left, its period last)
      h('h1', { class: 'title', attrs: { dir: 'auto' } }, v.title ?? ''),
      place || device ? h('div', { class: 'where' }, icon('pin'),
        h('span', null, place ? h('span', { attrs: { dir: 'auto' } }, place) : null, place && device ? ' · ' : null, device ? h('span', { attrs: { dir: 'auto' } }, device) : null)) : null,
      location ? h('div', { class: 'where', attrs: { 'data-location': true } }, icon('pin'), h('span', { attrs: { dir: 'auto' } }, location)) : null,
      this.statusLineEl(v),
      v.description ? h('p', { class: 'desc', attrs: { dir: 'auto' } }, v.description) : null,
      kind === 'vendor' && v.history && v.history.length ? this.historyBlock(v) : null,
      v.assigned_by ? h('div', { class: 'by-row' }, h('span', { class: 'avi', attrs: { 'aria-hidden': 'true' } }, (v.assigned_by.trim()[0] ?? '').toUpperCase()),
        h('span', { class: 'muted small' }, this.t('sentBy', { who: v.assigned_by }))) : null);
  }

  private historyLines(v: TicketView): HTMLElement {
    const list = h('ul', { class: 'history' });
    for (const item of v.history ?? []) {
      const actor = this.t(`h_${item.actor}`);
      list.appendChild(h('li', null, h('span', { attrs: { dir: 'auto' } }, `${item.from ?? '—'} → ${item.to ?? '—'}${actor ? ` · ${actor}` : ''}`),
        h('span', { class: 'when' }, this.when(item.at))));
    }
    return list;
  }

  private historyBlock(v: TicketView): HTMLElement {
    return h('details', { class: 'hist' }, h('summary', null, this.t('history')), this.historyLines(v));
  }

  /** The staff kind: the device's recent states in a card of their own (only when the department shares them - the server sends `history` or null). */
  private historyCard(v: TicketView): HTMLElement | null {
    if (!v.history || !v.history.length) return null;
    return h('section', { class: 'card num', attrs: { 'data-device-history': true } }, h('h2', null, this.t('history')), this.historyLines(v));
  }

  private statusCard(v: TicketView): HTMLElement | null {
    const a = v.actions!;
    const choices = statusChoices(v);
    if (!choices.length) return null;
    const card = h('section', { class: 'card num' }, h('h2', null, this.t('updateStatus')));
    const grid = h('div', { class: 'statuses', attrs: { role: 'radiogroup', 'aria-label': this.t('updateStatus') } });
    const eff = this.draft.status ?? v.status;
    for (const s of choices) {
      const current = lineOf(v.status) === s;
      const chosen = lineOf(eff) === s;
      const allowed = a.statuses.includes(s);
      grid.appendChild(h('button', {
        class: `status ${chosen ? 'on' : ''}`,
        attrs: { type: 'button', role: 'radio', 'aria-checked': String(chosen), disabled: !allowed && !current, 'data-status-choice': s },
        on: { click: () => { if (!allowed && !current) return; this.draft = { ...this.draft, status: current ? null : s }; this.saveDraft(); this.render(); } },
      }, icon('check'), h('span', { class: 'st-name' }, this.t(`btn_${s}`)),
      h('span', { class: 'st-sub' }, this.t(`btn_${s}_sub`)),
      s === 'in_progress' && eff === 'waiting_part' ? h('span', { class: 'st-wait', attrs: { 'data-waiting-sub': true } }, this.t('s_waiting_part')) : null));
    }
    card.appendChild(grid);
    const tg = partToggle(v, this.draft.status);
    if (tg) {
      card.appendChild(h('button', { class: `pill wait ${tg.on ? 'on' : ''}`, attrs: { type: 'button', 'aria-pressed': String(tg.on), 'data-waiting-toggle': tg.on ? 'back' : 'mark' },
        on: { click: () => { this.draft = { ...this.draft, status: tg.next }; this.saveDraft(); this.render(); } } },
      h('span', { class: 'sw', attrs: { 'aria-hidden': 'true' } }), h('span', null, this.t(tg.on ? 'wait_back' : 'wait_mark'))));
    }
    return card;
  }

  private etaCard(v: TicketView): HTMLElement | null {
    if (!v.actions?.eta) return null;
    return h('section', { class: 'card num' }, h('h2', null, this.t('cardWhen')), this.etaBlock(v));
  }

  private noteCard(v: TicketView): HTMLElement | null {
    if (!v.actions?.note) return null;
    const ta = h('textarea', { class: 'input note', attrs: { rows: 3, maxlength: v.limits?.note_max ?? 2000, placeholder: this.t('notePlaceholder'),
      'aria-label': this.t('note'), dir: 'auto', 'data-note': true },
    on: { input: (e) => { this.draft = { ...this.draft, note: (e.target as HTMLTextAreaElement).value }; this.saveDraft(); this.syncChrome(); } } });
    ta.value = this.draft.note;
    const ask = !!this.draft.ask;
    const toggle = h('button', { class: `pill ${ask ? 'on' : ''}`, attrs: { type: 'button', 'aria-pressed': String(ask), 'data-ask-manager': true, title: this.t('askHint') },
      on: { click: () => { this.draft = { ...this.draft, ask: !ask }; this.saveDraft(); this.render(); } } }, this.t('askManager'));
    return h('section', { class: 'card num' }, h('h2', null, this.t('cardDone')), ta, h('div', { class: 'pills' }, toggle));
  }

  private photosCard(v: TicketView): HTMLElement | null {
    const a = v.actions!;
    if (!a.photo && !(v.photos ?? []).length) return null;
    return h('section', { class: 'card num' }, h('h2', null, this.t('photos')), this.photosBlock(v, a.photo));
  }

  private etaBlock(v: TicketView): HTMLElement {
    const zone = v.time_zone;
    const current = this.draft.eta !== undefined ? this.draft.eta : v.eta_at ?? null;
    const chip = (choice: EtaChoice, key: Key) => {
      const iso = etaFor(choice, Date.now(), zone);
      const on = current === iso;
      return h('button', { class: `pill ${on ? 'on' : ''}`, attrs: { type: 'button', 'aria-pressed': String(on), 'data-eta': choice },
        on: { click: () => { this.etaOther = false; this.draft = { ...this.draft, eta: on ? undefined : iso }; this.saveDraft(); this.render(); } } }, this.t(key));
    };
    const pills = h('div', { class: 'pills', attrs: { role: 'group', 'aria-label': this.t('eta') } }, chip('today', 'etaToday'), chip('tomorrow', 'etaTomorrow'), chip('two_days', 'etaTwoDays'),
      h('button', { class: `pill ${this.etaOther ? 'on' : ''}`, attrs: { type: 'button', 'aria-pressed': String(this.etaOther), 'data-eta': 'other' },
        on: { click: () => { this.etaOther = !this.etaOther; this.render(); } } }, this.t('etaOther')));
    const block = h('div', { class: 'field' }, pills);
    if (this.etaOther) {
      const input = h('input', { class: 'input', attrs: { type: 'datetime-local', 'data-eta-input': true, dir: 'ltr', 'aria-label': this.t('eta') },
        on: { change: (e) => { const iso = localInputToIso((e.target as HTMLInputElement).value, zone); if (iso) { this.draft = { ...this.draft, eta: iso }; this.saveDraft(); this.render(); } } } });
      input.value = isoToLocalInput(current, zone);
      block.appendChild(input);
    }
    if (current) {
      const note = zoneNote(zone);
      block.appendChild(h('div', { class: 'muted small', attrs: { 'data-eta-value': true } }, this.t('etaSet', { when: this.when(current) }),
        note ? ` (${this.t('timeZone', { zone: note })})` : '',
        ' ', h('button', { class: 'linkish', attrs: { type: 'button' }, on: { click: () => { this.draft = { ...this.draft, eta: null }; this.saveDraft(); this.render(); } } }, this.t('etaClear'))));
    }
    return block;
  }

  private photosBlock(v: TicketView, canAdd: boolean): HTMLElement {
    const row = h('div', { class: 'photos' });
    for (const p of v.photos ?? []) {
      const url = this.photos.get(p.id);
      row.appendChild(url ? img(url, this.t('t_photo'), 'thumb') : h('div', { class: 'thumb empty', attrs: { 'aria-hidden': 'true' } }, icon('image')));
    }
    const block = h('div', { class: 'field' });
    if (canAdd) {
      const pick = (capture: boolean) => {
        const input = h('input', { attrs: { type: 'file', accept: 'image/jpeg,image/png', capture: capture ? 'environment' : null, hidden: true,
          'data-photo-input': capture ? 'camera' : 'gallery' },
        on: { change: (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void this.upload(f); } } });
        return h('label', { class: `btn ${capture ? 'cam' : ''}` }, icon(capture ? 'camera' : 'image'), h('span', null, this.t(capture ? 'takePhoto' : 'pickPhoto')), input);
      };
      block.appendChild(h('div', { class: 'row wrap' }, pick(true), pick(false)));
    }
    if ((v.photos ?? []).length) block.appendChild(row);
    return block;
  }

  private timelineCard(v: TicketView): HTMLElement | null {
    const items = v.timeline ?? [];
    if (!items.length) return null;
    const list = h('ol', { class: 'timeline' });
    for (const it of [...items].reverse()) {
      const who = it.mine ? this.t('you') : it.name;
      let line = '';
      if (it.kind === 'status' && it.to) line = this.t('t_status', { status: this.t(`s_${it.to}`) });
      else if (it.kind === 'eta') line = this.t('t_eta', { when: it.eta_at ? this.when(it.eta_at) : '—' });
      else if (it.kind === 'photo') line = this.t('t_photo');
      else if (it.kind === 'returned') line = this.t('t_returned');
      else line = this.t(it.question ? 't_question' : 't_note');
      list.appendChild(h('li', { class: it.mine ? 'mine' : 'theirs' },
        h('div', { class: 'meta' }, h('span', { class: 'who' }, who), h('span', { class: 'when' }, this.when(it.at))),
        h('div', { class: 'what' }, line),
        it.body ? h('div', { class: 'body', attrs: { dir: 'auto' } }, it.body) : null,
        it.photo_id && this.photos.get(it.photo_id) ? img(this.photos.get(it.photo_id)!, this.t('t_photo'), 'thumb') : null));
    }
    return h('section', { class: 'card num' }, h('h2', null, this.t('timeline')), list);
  }

  private returnBlock(): HTMLElement {
    if (!this.ret.open) {
      return h('div', { class: 'center-row' }, h('button', { class: 'linkish under', attrs: { type: 'button', 'data-not-mine': true },
        on: { click: () => { this.ret.open = true; this.render(); } } }, this.t('notMineLink')));
    }
    const kinds = h('div', { class: 'pills', attrs: { role: 'radiogroup' } });
    for (const k of ['not_mine', 'cannot_handle'] as const) {
      kinds.appendChild(h('button', { class: `pill ${this.ret.kind === k ? 'on' : ''}`, attrs: { type: 'button', role: 'radio', 'aria-checked': String(this.ret.kind === k), 'data-return-kind': k },
        on: { click: () => { this.ret.kind = k; this.render(); } } }, this.t(k === 'not_mine' ? 'returnNotMine' : 'returnCannot')));
    }
    const ta = h('textarea', { class: 'input', attrs: { rows: 3, maxlength: this.view?.limits?.reason_max ?? 500, 'aria-label': this.t('returnReason'), dir: 'auto',
      'data-return-reason': true, 'aria-invalid': String(!!this.ret.error) }, on: { input: (e) => {
        const field = e.target as HTMLTextAreaElement;
        this.ret.reason = field.value;
        if (this.ret.error) { // the "a reason is required" line goes as soon as one is typed - without a render that would take the caret away
          this.ret.error = null;
          field.setAttribute('aria-invalid', 'false');
          field.parentElement?.querySelector('.field-error')?.remove();
        }
      } } });
    ta.value = this.ret.reason;
    return h('section', { class: 'card ret', attrs: { 'data-return': true } },
      h('h3', null, this.t('returnTitle')),
      h('p', { class: 'msg-body start' }, this.t('returnAsk')),
      kinds,
      ta,
      this.ret.error ? h('div', { class: 'field-error', attrs: { role: 'alert' } }, this.t(this.ret.error)) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', attrs: { type: 'button', disabled: this.busy, 'data-return-send': true }, on: { click: () => void this.giveBack() } }, icon('back'), this.t('returnSend')),
        h('button', { class: 'btn', attrs: { type: 'button' }, on: { click: () => { this.ret = { ...this.ret, open: false, error: null }; this.render(); } } }, this.t('cancel'))));
  }

  private footer(): HTMLElement {
    const v = this.view;
    const note = v ? zoneNote(v.time_zone) : null;
    // in the read-only grace after close the link ends with the grace, not at its sliding expiry
    const until = v ? (v.read_only && v.read_only_until ? this.when(v.read_only_until) : v.expires_at ? formatDate(v.expires_at, v.time_zone, this.lang) : '') : '';
    return h('footer', { class: 'foot' },
      until ? h('div', null, this.t('linkFooter', { when: until })) : null,
      note ? h('div', null, this.t('timeZone', { zone: note })) : null,
      this.lang === 'ar' || this.lang === 'ru' ? h('div', { class: 'prelim', attrs: { 'data-prelim': true } }, this.t('prelim')) : null,
      h('button', { class: 'linkish', attrs: { type: 'button', 'data-finish': true }, on: { click: () => this.finish() } }, this.t('finish')));
  }
}

const root = document.getElementById('app');
if (root) new Page(root).start();
