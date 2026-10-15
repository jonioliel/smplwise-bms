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
import { api, newRequestId, type ApiFailure, type Credentials, type TicketView, rawCall } from './api';
import { h, icon, img } from './dom';
import { afterFailure, afterStep, bootFrom, codeMessage, EMPTY_DRAFT, parseDraft, phaseOf, lineOf, partToggle, planSend, statusChoices, validSession,
  type Draft, type Phase, type Step } from './state';
import { CATALOGUES, isLang, LANGS, preferredLang, RTL, text, type Key, type Lang } from './strings';
import { etaFor, formatDate, formatWhen, isoToLocalInput, localInputToIso, zoneNote, type EtaChoice } from './time';

const STORE = { token: 'arx.t.token', session: 'arx.t.session', lang: 'arx.t.lang', draft: 'arx.t.draft' } as const;

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
  // slice 9 (11A.2): the cost-claim step - a persistent host (the page re-renders its DOM; the step keeps its own state) and the
  // lazily loaded module (its chunk is fetched only when a claim exists)
  private claimHost: HTMLElement | null = null;
  private claimHandle: { refresh(): Promise<void>; destroy(): void } | null = null;
  private claimLoading = false;
  private rid: string | null = null;
  private phase: Phase = 'loading';
  private view: TicketView | null = null;
  private lang: Lang = 'he';
  private chosenLang: Lang | null = null;
  private banner: { key: string; tone: 'ok' | 'bad' | 'info'; n?: number } | null = null;
  private draft: Draft = { ...EMPTY_DRAFT, crids: {} };
  private busy = false;
  private etaOther = false;
  private ret: ReturnForm = { open: false, kind: 'not_mine', reason: '', crid: null, error: null };
  private returned: { number: number; kind: string } | null = null;
  private code = { sent: false, value: '', message: null as null | { key: string; n?: number } };
  private photos = new Map<string, string>();
  private uploading = 0;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    const saved = stored(STORE.lang);
    if (isLang(saved)) this.chosenLang = saved;
    // before a ticket answers (an expired link, the redeem screen): the choice made here, else the browser's language
    this.lang = this.chosenLang ?? preferredLang(typeof navigator !== 'undefined' ? navigator.languages : null) ?? 'he';
    const boot = bootFrom(window.location.hash, window.location.pathname, stored(STORE.token));
    if (boot.fromFragment || boot.rid) {
      try {
        history.replaceState(null, '', '/t/'); // the token never stays in the address bar, the history or a bookmark
      } catch {
        /* ignore */
      }
    }
    this.draft = parseDraft(stored(STORE.draft));
    if (boot.token) {
      this.setToken(boot.token);
      this.creds.session = validSession(stored(STORE.session));
      void this.load();
    } else if (boot.rid) {
      this.rid = boot.rid;
      this.phase = 'redeem';
      this.render();
    } else {
      this.phase = 'unavailable';
      this.render();
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.creds.token && ['ready', 'readonly', 'code', 'busy', 'error'].includes(this.phase)) void this.load();
    });
    window.addEventListener('online', () => {
      if (this.phase === 'ready' && this.hasDraft()) void this.send();
    });
  }

  // ---------------------------------------------------------------- state

  private setToken(token: string | null): void {
    this.creds.token = token;
    store(STORE.token, token);
  }

  private forget(): void {
    this.setToken(null);
    this.creds.session = null;
    store(STORE.session, null);
    store(STORE.draft, null);
    this.draft = { ...EMPTY_DRAFT, crids: {} };
    for (const url of this.photos.values()) URL.revokeObjectURL(url);
    this.photos.clear();
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
    this.lang = this.chosenLang ?? (isLang(r.data.lang) ? r.data.lang : 'he');
    this.phase = phaseOf(r.data);
    if (this.phase === 'code' && (r.data.code_locked_s ?? 0) > 0) this.code.message = { key: 'codeLocked', n: Math.ceil((r.data.code_locked_s ?? 60) / 60) };
    this.render();
    void this.loadPhotos();
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
    if (step.kind === 'note') return api.note(this.creds, step.text, step.crid);
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
    this.code = { sent: true, value: '', message: { key: 'codeSent', n: Math.max(1, Math.round((r.data.expires_in_s || 600) / 60)) } };
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
        h('div', { class: 'avatar', attrs: { 'aria-hidden': 'true' } }, (org.trim()[0] ?? '#').toUpperCase()),
        h('div', { class: 'who' },
          org ? h('div', { class: 'org' }, org) : null,
          v ? h('div', { class: 'sub' }, this.t('number', { number: v.number }), v.department ? ` · ${v.department}` : '') : null)),
      this.langPicker());
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
        m ? h('div', { class: `banner ${m.key === 'codeSent' ? 'ok' : 'bad'}`, attrs: { role: 'status', 'data-code-message': m.key } }, this.t(m.key, { n: m.n ?? '' })) : null,
        this.code.sent ? h('div', { class: 'row' }, input,
          h('button', { class: 'btn primary', attrs: { type: 'button', disabled: this.busy, 'data-code-verify': true }, on: { click: () => void this.codeVerify() } }, this.t('codeVerify'))) : null,
        h('button', { class: `btn ${this.code.sent ? 'ghost' : 'primary'} block`, attrs: { type: 'button', disabled: this.busy, 'data-code-send': true },
          on: { click: () => void this.codeSend() } }, this.t(this.code.sent ? 'codeResend' : 'codeSend')),
      ),
      this.footer()));
  }

  private ticketScreen(): HTMLElement {
    const v = this.view;
    if (!v) return this.message('errorTitle', 'errorBody', 'clock', true);
    const readOnly = this.phase === 'readonly';
    return h('div', { class: 'page' }, this.header(), h('main', { class: 'col' },
      this.bannerEl(),
      readOnly && !v.claim_mode ? h('section', { class: 'card closed', attrs: { 'data-readonly': true } },
        h('div', { class: 'msg-icon ok' }, icon('done')),
        h('h1', { class: 'msg-title' }, this.t('closedTitle')),
        v.read_only_until ? h('p', { class: 'msg-body' }, this.t('closedBody', { when: this.when(v.read_only_until) })) : null) : null,
      this.ticketCard(v),
      this.claimBlock(v),
      !readOnly && v.actions ? this.updateCard(v) : null,
      v.claim_mode ? null : this.timelineCard(v),
      !readOnly && v.actions?.return ? this.returnBlock() : null,
      this.footer()));
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
      void import('./claim/claim-step').then((m) => {
        this.claimHandle = m.mountClaimStep(host, {
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

  private ticketCard(v: TicketView): HTMLElement {
    const prio = v.priority ? (this.lang === 'he' && v.priority.name ? v.priority.name : this.t(`priority_${v.priority.key}`)) : '';
    const place = [v.place_text, v.device_name].filter(Boolean);
    return h('section', { class: 'card ticket', attrs: { 'data-ticket': v.number } },
      h('div', { class: 'chips' },
        v.status ? h('span', { class: `chip st-${v.status}`, attrs: { 'data-status': v.status } }, v.status === 'waiting_part' ? `${this.t('s_in_progress')} · ${this.t('s_waiting_part')}` : this.t(`s_${v.status}`)) : null,
        prio ? h('span', { class: `chip pr-${v.priority?.key ?? ''}` }, prio) : null,
        h('span', { class: 'spacer' }),
        v.created_at ? h('span', { class: 'muted small' }, this.t('openedAt', { when: formatDate(v.created_at, v.time_zone, this.lang) })) : null),
      // the ticket's own words keep their own direction (a Hebrew title on a Russian page reads right to left, its period last)
      h('h2', { class: 'title', attrs: { dir: 'auto' } }, v.title ?? ''),
      place.length ? h('div', { class: 'where' }, icon('pin'), h('span', { attrs: { dir: 'auto' } }, place.join(' · '))) : null,
      v.description ? h('p', { class: 'desc', attrs: { dir: 'auto' } }, v.description) : null,
      v.history && v.history.length ? this.historyBlock(v) : null,
      v.assigned_by ? h('div', { class: 'muted small by' }, this.t('sentBy', { who: v.assigned_by })) : null);
  }

  private historyBlock(v: TicketView): HTMLElement {
    const list = h('ul', { class: 'history' });
    for (const item of v.history ?? []) {
      const actor = this.t(`h_${item.actor}`);
      list.appendChild(h('li', null, h('span', { class: 'when' }, this.when(item.at)), ' · ',
        h('span', { attrs: { dir: 'auto' } }, `${item.from ?? '—'} → ${item.to ?? '—'}`), actor ? ` · ${actor}` : ''));
    }
    return h('details', { class: 'hist' }, h('summary', null, this.t('history')), list);
  }

  private updateCard(v: TicketView): HTMLElement {
    const a = v.actions!;
    const card = h('section', { class: 'card update' }, h('h3', null, this.t('updateStatus')));
    const choices = statusChoices(v);
    if (choices.length) {
      const grid = h('div', { class: 'statuses', attrs: { role: 'radiogroup', 'aria-label': this.t('updateStatus') } });
      const icons: Record<string, string> = { acknowledged: 'check', in_progress: 'wrench', done: 'done' };
      const eff = this.draft.status ?? v.status;
      for (const s of choices) {
        const current = lineOf(v.status) === s;
        const chosen = lineOf(eff) === s;
        const allowed = a.statuses.includes(s);
        grid.appendChild(h('button', {
          class: `status ${chosen ? 'on' : ''}`,
          attrs: { type: 'button', role: 'radio', 'aria-checked': String(chosen), disabled: !allowed && !current, 'data-status-choice': s },
          on: { click: () => { if (!allowed && !current) return; this.draft = { ...this.draft, status: current ? null : s }; this.saveDraft(); this.render(); } },
        }, icon(icons[s] ?? 'check'), h('span', { class: 'st-name' }, this.t(`btn_${s}`)),
        h('span', { class: 'st-sub' }, this.t(`btn_${s}_sub`)),
        s === 'in_progress' && eff === 'waiting_part' ? h('span', { class: 'st-wait', attrs: { 'data-waiting-sub': true } }, this.t('s_waiting_part')) : null));
      }
      card.appendChild(grid);
      const tg = partToggle(v, this.draft.status);
      if (tg) {
        card.appendChild(h('button', { class: `pill wait ${tg.on ? 'on' : ''}`, attrs: { type: 'button', 'aria-pressed': String(tg.on), 'data-waiting-toggle': tg.on ? 'back' : 'mark' },
          on: { click: () => { this.draft = { ...this.draft, status: tg.next }; this.saveDraft(); this.render(); } } }, icon('box'), this.t(tg.on ? 'wait_back' : 'wait_mark')));
      }
    }
    if (a.eta) card.appendChild(this.etaBlock(v));
    if (a.note) {
      const ta = h('textarea', { class: 'input note', attrs: { rows: 3, maxlength: v.limits?.note_max ?? 2000, placeholder: this.t('notePlaceholder'),
        'aria-label': this.t('note'), dir: 'auto', 'data-note': true },
      on: { input: (e) => { this.draft = { ...this.draft, note: (e.target as HTMLTextAreaElement).value }; this.saveDraft(); } } });
      ta.value = this.draft.note;
      card.appendChild(h('label', { class: 'field' }, h('span', { class: 'lbl' }, this.t('note')), ta));
    }
    if (a.photo || (v.photos ?? []).length) card.appendChild(this.photosBlock(v, a.photo));
    card.appendChild(h('button', { class: 'btn primary block send', attrs: { type: 'button', disabled: this.busy, 'data-send': true },
      on: { click: () => void this.send() } }, icon('send'), this.t(this.busy ? 'sending' : 'send')));
    return card;
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
    const pills = h('div', { class: 'pills' }, chip('today', 'etaToday'), chip('tomorrow', 'etaTomorrow'), chip('two_days', 'etaTwoDays'),
      h('button', { class: `pill ${this.etaOther ? 'on' : ''}`, attrs: { type: 'button', 'aria-pressed': String(this.etaOther), 'data-eta': 'other' },
        on: { click: () => { this.etaOther = !this.etaOther; this.render(); } } }, this.t('etaOther')));
    const block = h('div', { class: 'field' }, h('span', { class: 'lbl' }, this.t('eta')), pills);
    if (this.etaOther) {
      const input = h('input', { class: 'input', attrs: { type: 'datetime-local', 'data-eta-input': true, dir: 'ltr' },
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
    const block = h('div', { class: 'field' }, h('span', { class: 'lbl' }, this.t('photos')));
    if (canAdd) {
      const pick = (capture: boolean) => {
        const input = h('input', { attrs: { type: 'file', accept: 'image/jpeg,image/png', capture: capture ? 'environment' : null, hidden: true,
          'data-photo-input': capture ? 'camera' : 'gallery' },
        on: { change: (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void this.upload(f); } } });
        return h('label', { class: 'btn' }, icon(capture ? 'camera' : 'image'), h('span', null, this.t(capture ? 'takePhoto' : 'pickPhoto')), input);
      };
      block.appendChild(h('div', { class: 'row wrap' }, pick(true), pick(false)));
    }
    if ((v.photos ?? []).length) block.appendChild(row);
    block.appendChild(h('div', { class: 'muted small' }, this.t('documentsHint')));
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
      else line = this.t('t_note');
      list.appendChild(h('li', { class: it.mine ? 'mine' : 'theirs' },
        h('div', { class: 'meta' }, h('span', { class: 'who' }, who), h('span', { class: 'when' }, this.when(it.at))),
        h('div', { class: 'what' }, line),
        it.body ? h('div', { class: 'body', attrs: { dir: 'auto' } }, it.body) : null,
        it.photo_id && this.photos.get(it.photo_id) ? img(this.photos.get(it.photo_id)!, this.t('t_photo'), 'thumb') : null));
    }
    return h('section', { class: 'card' }, h('h3', null, this.t('timeline')), list);
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
      h('button', { class: 'linkish', attrs: { type: 'button', 'data-finish': true }, on: { click: () => this.finish() } }, this.t('finish')));
  }
}

const root = document.getElementById('app');
if (root) new Page(root).start();
