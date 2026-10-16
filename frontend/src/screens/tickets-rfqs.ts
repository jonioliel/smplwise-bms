import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../tickets/rfq-new';
import '../tickets/rfq-board';
import '../tickets/rfq-compare';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles } from '../styles/media-page';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError } from '../api/client';
import { replaceRoute, type RouteState } from '../router';
import { ticketsApi } from '../api/tickets';
import { RFQ_FILTERS, rfqUnavailable, ticketsRfqApi, type RfqMeta, type RfqSummary } from '../api/tickets-rfq';
import { onTicketNames, setTicketNames } from '../tickets/naming';
import { formatMoney } from '../tickets/cost-model';
import { tIcon } from '../tickets/icons';
import { rt, type RfqTextKey } from '../tickets/rfq-text';
import { rfqStyles } from '../tickets/rfq-styles';
import { dateTime, duePassed, inFilter, listTiles, matchesQuery, parseRfqRoute, rfqHref, rfqStateTone, statusBar, stripCounts, type RfqRoute } from '../tickets/rfq-model';
import { rfqError } from '../tickets/rfq-new';
import { tt, ticketsLang } from '../tickets/text';

type Screen = 'loading' | 'ready' | 'error' | 'forbidden' | 'off' | 'unavailable';

function go(href: string, replace = false): void {
  if (!replace) {
    window.location.hash = href;
    return;
  }
  const [path, query = ''] = href.replace(/^#/, '').split('?');
  replaceRoute(path, new URLSearchParams(query));
}

/**
 * TKRFQ2 (release 2.6.1) "בקשות הצעת מחיר" (#/tickets/rfqs): the manager's requests for quotation - a request sent to SEVERAL vendors
 * with no commitment to award. The page frame of the module (large title, department chips, the state strip with counts, search, "+"),
 * the KPI glass tiles, and one row per request with its vendors' status (invited / opened / quoted / declined / no reply) as a bar.
 * `?rfq=<id>` opens one request's vendors board (tickets/rfq-board.ts), `&view=compare` its comparison and award
 * (tickets/rfq-compare.ts), `?new=1[&from=<ticket id>]` the new-request sheet (tickets/rfq-new.ts). The server's visibility rule decides
 * every row; actions follow its `can` flags. States: loading, empty, no match, error, forbidden, the module off, and "not available on
 * this server" (before the RFQ routes are deployed).
 */
@customElement('tickets-rfqs')
export class TicketsRfqsPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private r: RfqRoute = parseRfqRoute(new URLSearchParams());
  @state() private screen: Screen = 'loading';
  @state() private meta: RfqMeta | null = null;
  @state() private items: RfqSummary[] = [];
  @state() private next: string | null = null;
  @state() private failed = '';
  @state() private q = '';
  @state() private toast: { text: string; tone: 'ok' | 'bad' } | null = null;
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private toastTimer = 0;
  private qTimer = 0;
  private offNames: (() => void) | null = null;

  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, rfqStyles];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.offNames = onTicketNames(() => this.requestUpdate());
    void this.boot();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.phoneMq.removeEventListener('change', this.onPhone);
    this.offNames?.();
    window.clearTimeout(this.toastTimer);
    window.clearTimeout(this.qTimer);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('route') && this.route) {
      const prev = this.r;
      this.r = parseRfqRoute(this.route.params);
      if (prev.q !== this.r.q) this.q = this.r.q;
      // back on the list after a request changed: a quiet re-read
      if (this.screen === 'ready' && this.r.view === 'list' && prev.view !== 'list') void this.load(true);
    }
  }

  private async boot(): Promise<void> {
    try {
      const m = await ticketsApi().module();
      setTicketNames(m.name);
      if (!m.enabled) {
        this.screen = 'off';
        return;
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && e.code === 'feature_disabled') {
        this.screen = 'off';
        return;
      }
    }
    try {
      this.meta = await ticketsRfqApi().meta();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.screen = 'forbidden';
      else if (e instanceof ApiError && e.code === 'feature_disabled') this.screen = 'off';
      else if (rfqUnavailable(e)) this.screen = 'unavailable';
      else {
        this.failed = rfqError(e);
        this.screen = 'error';
      }
      return;
    }
    await this.load(false);
  }

  /** One page of every visible request (`state=all`): the strip's counts and the filters are read from it. */
  private async load(quiet: boolean, more = false): Promise<void> {
    if (!quiet && !this.items.length) this.screen = 'loading';
    try {
      const page = await ticketsRfqApi().list({ state: 'all', limit: 200, cursor: more ? this.next : null });
      this.items = more ? [...this.items, ...page.items] : page.items;
      this.next = page.next_cursor;
      this.screen = 'ready';
    } catch (e) {
      if (quiet) return;
      if (e instanceof ApiError && e.status === 403) this.screen = 'forbidden';
      else {
        this.failed = rfqError(e);
        this.screen = 'error';
      }
    }
  }

  private say(text: string, tone: 'ok' | 'bad' = 'ok'): void {
    this.toast = { text, tone };
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = null), tone === 'bad' ? 7000 : 3500);
  }

  private onNotice = (e: CustomEvent<{ ok?: string; error?: string }>) => {
    if (e.detail.error) this.say(e.detail.error, 'bad');
    else if (e.detail.ok) this.say(e.detail.ok);
    void this.load(true);
  };

  private onSearch(v: string): void {
    this.q = v;
    window.clearTimeout(this.qTimer);
    this.qTimer = window.setTimeout(() => go(rfqHref({ ...this.r, q: v, id: '', creating: false }), true), 250);
  }

  private canCreate(): boolean {
    return !!this.meta?.departments.some((d) => d.can_create);
  }

  private money(minor: number | null, currency: string | null): string {
    return minor === null ? '' : formatMoney(minor, currency ?? 'ILS', ticketsLang() === 'en' ? 'en' : 'he');
  }

  // ---------------------------------------------------------------- the list

  private visible(): RfqSummary[] {
    return this.items.filter((i) => inFilter(i.state, this.r.state) && (!this.r.dept || i.department.id === this.r.dept) && matchesQuery(i, this.q));
  }

  private header(): TemplateResult {
    const depts = this.meta?.departments ?? [];
    const base = this.items.filter((i) => !this.r.dept || i.department.id === this.r.dept);
    const strip = stripCounts(base, RFQ_FILTERS).filter((s) => s.id === 'open' || s.id === 'all' || s.count > 0 || s.id === this.r.state);
    return html`<header class="dh" data-rfq-header>
      <div class="dh-row">
        <div class="titles"><div class="crumbs"><a href="#/tickets">${tt('area')}</a></div><h1 data-rfq-page-title>${rt('navTitle')}</h1></div>
        <span class="grow"></span>
      </div>
      ${this.screen === 'ready' ? html`<div class="dh-det">
        ${depts.length > 1 ? html`<div class="rooms" role="group" aria-label=${rt('departmentsGroup')} data-rfq-depts>
          <button type="button" class="rc" aria-pressed=${String(!this.r.dept)} data-dept="" @click=${() => go(rfqHref({ ...this.r, dept: '' }))}>${rt('allDepartments')}</button>
          ${depts.map((d) => html`<button type="button" class="rc" aria-pressed=${String(this.r.dept === d.id)} data-dept=${d.id} @click=${() => go(rfqHref({ ...this.r, dept: d.id }))}>${bidi(d.name)}</button>`)}
        </div>` : nothing}
        <div class="seg sm stf" role="radiogroup" aria-label=${rt('stateStrip')} data-rfq-strip>
          ${strip.map((s) => html`<button type="button" role="radio" aria-checked=${String(this.r.state === s.id)} data-state=${s.id}
            @click=${() => go(rfqHref({ ...this.r, state: s.id }))}>${rt(`st_${s.id}` as RfqTextKey)}<small>${s.count}</small></button>`)}
        </div>
        <span class="grow"></span>
        <label class="search">${tIcon('search')}<span class="vh">${rt('searchShort')}</span><input type="search" data-rfq-search maxlength="80"
          placeholder=${this.phone ? rt('searchShort') : rt('searchPh')} .value=${this.q} @input=${(e: Event) => this.onSearch((e.target as HTMLInputElement).value)} /></label>
        ${this.canCreate() ? html`<button type="button" class="btn primary newbtn" data-rfq-new-btn @click=${() => go(rfqHref({ ...this.r, creating: true }))}>${tIcon('plus')}${rt('newShort')}</button>` : nothing}
      </div>` : nothing}
    </header>`;
  }

  private tiles(): TemplateResult {
    const t = listTiles(this.items.filter((i) => !this.r.dept || i.department.id === this.r.dept));
    const tile = (label: RfqTextKey, n: number, attr: string, warn = false) => html`<div class=${`kpi${warn ? ' warn' : ''}`} data-kpi=${attr}><small>${rt(label)}</small><b>${n}</b></div>`;
    return html`<div class="kpis" data-rfq-tiles>
      ${tile('tileOpen', t.open, 'open')}${tile('tileCollecting', t.collecting, 'collecting')}${tile('tileDecide', t.decide, 'decide', t.decide > 0)}
      ${tile('tileQuotes', t.quotes, 'quotes')}${tile('tileNoReply', t.noReply, 'no_reply')}
    </div>`;
  }

  private bar(i: RfqSummary): TemplateResult {
    const parts = statusBar(i.kpis);
    const label = (k: string) => rt(`vs_${k === 'opened' ? 'opened' : k}` as RfqTextKey);
    const color: Record<string, string> = { quoted: 'seg-q', declined: 'seg-d', opened: 'seg-o', no_reply: 'seg-n' };
    if (!i.kpis.invited) return html`<div class="vbar"><span class="mut">${rt('noVendorsYet')}</span></div>`;
    return html`<div class="vbar" data-rfq-vbar>
      <div class="track" role="img" aria-label=${parts.map((p) => `${label(p.key)} ${p.n}`).join(', ')}>${parts.map((p) => html`<span class=${color[p.key]} style=${`inline-size:${p.pct}%`}></span>`)}</div>
      <div class="legend">
        <span>${rt('vendorsLine', { n: i.kpis.invited })}</span>
        ${parts.map((p) => html`<span data-vb=${p.key}><i class=${color[p.key]}></i>${label(p.key)} ${p.n}</span>`)}
      </div>
    </div>`;
  }

  private row(i: RfqSummary, now: Date): TemplateResult {
    const late = duePassed(i.due_at, now);
    return html`<li><a class="rrow" href=${rfqHref({ id: i.id })} data-rfq-row=${i.id} data-rstate=${i.state}>
      <div class="t">
        <span class="meta"><span class="ref">${i.ref}</span><span class=${`chip ${rfqStateTone(i.state)}`} data-rfq-row-state>${rt(`st_${i.state}` as RfqTextKey)}</span></span>
        <b>${bidi(i.title)}</b>
        <span class="meta"><span>${bidi(i.department.name)}</span>${i.place_text ? html`<span>${bidi(i.place_text)}</span>` : nothing}
          <span>${i.due_at ? (late ? rt('duePassed', { when: dateTime(i.due_at) }) : rt('dueIn', { when: dateTime(i.due_at) })) : rt('noDue')}</span>
          ${i.internal_owner.name ? html`<span>${rt('owner')}: ${bidi(i.internal_owner.name)}</span>` : nothing}</span>
      </div>
      ${this.bar(i)}
      <div class="end">${i.kpis.lowest_total_minor !== null ? html`<span class="num" data-rfq-lowest><b>${rt('lowestLine', { amount: this.money(i.kpis.lowest_total_minor, i.kpis.currency) })}</b></span>` : nothing}
        <span class="chip">${rt('vs_quoted')} ${i.kpis.quoted}</span></div>
    </a></li>`;
  }

  private stateBox(icon: Parameters<typeof tIcon>[0], title: string, kind: string, action?: TemplateResult): TemplateResult {
    return html`<div class="statebox glass" role="status" data-rfq-state=${kind}><span class="ring">${tIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }

  private list(): TemplateResult {
    switch (this.screen) {
      case 'loading':
        return html`<div data-rfq-state="loading" aria-busy="true" class="stack"><div class="kpis">${[1, 2, 3, 4, 5].map(() => html`<span class="skl" style="block-size:76px"></span>`)}</div>
          ${[1, 2, 3].map(() => html`<span class="skl" style="block-size:88px"></span>`)}</div>`;
      case 'off':
        return this.stateBox('ticket', rt('moduleOff'), 'off');
      case 'forbidden':
        return this.stateBox('lock', rt('forbidden'), 'forbidden');
      case 'unavailable':
        return this.stateBox('clock', rt('unavailable'), 'unavailable');
      case 'error':
        return this.stateBox('warning', rt('loadFailed'), 'error', html`<span class="vh">${this.failed}</span><button type="button" class="btn sm" data-rfq-retry
          @click=${() => { this.screen = 'loading'; void this.boot(); }}>${tIcon('refresh')}${rt('retry')}</button>`);
      default:
        break;
    }
    const now = new Date();
    const rows = this.visible();
    if (!this.items.length) {
      return html`${this.tiles()}${this.stateBox('note', rt('emptyAll'), 'empty', this.canCreate() ? html`<button type="button" class="btn sm primary" @click=${() => go(rfqHref({ creating: true }))}>${tIcon('plus')}${rt('newShort')}</button>` : undefined)}`;
    }
    return html`${this.tiles()}
      ${rows.length ? html`<ul class="rlist" aria-label=${rt('listAria')} data-rfq-list>${repeat(rows, (i) => i.id, (i) => this.row(i, now))}</ul>`
        : this.stateBox('search', rt('emptyFiltered'), 'no-match', html`<button type="button" class="btn sm" data-rfq-clear @click=${() => { this.q = ''; go(rfqHref({})); }}>${rt('clearFilters')}</button>`)}
      ${this.next ? html`<div><button type="button" class="btn sm" data-rfq-more @click=${() => void this.load(true, true)}>${rt('loadMore')}</button></div>` : nothing}`;
  }

  private onSaved = (e: CustomEvent<{ id: string; sent: boolean; manual?: boolean }>) => {
    this.say(e.detail.sent ? (e.detail.manual ? rt('sendMarked') : rt('sendDone')) : rt('draftSaved'));
    void this.load(true);
    go(rfqHref({ id: e.detail.id }));
  };

  render() {
    const r = this.r;
    const ready = this.screen === 'ready';
    const body = ready && r.view === 'board'
      ? html`<tickets-rfq-board .rfqId=${r.id} .meta=${this.meta} @notice=${this.onNotice} @gone=${() => go(rfqHref({}))}></tickets-rfq-board>`
      : ready && r.view === 'compare'
        ? html`<tickets-rfq-compare .rfqId=${r.id} .meta=${this.meta} @notice=${this.onNotice}></tickets-rfq-compare>`
        : html`<div class="page" data-screen="tickets-rfqs">${this.header()}${this.list()}</div>`;
    return html`${body}
      ${ready && this.canCreate() ? html`<tickets-rfq-new .open=${r.creating} .meta=${this.meta} .sourceTicket=${r.from}
        @close=${() => go(rfqHref({ ...r, creating: false, from: '' }), true)} @rfq-saved=${this.onSaved}></tickets-rfq-new>` : nothing}
      ${this.toast ? html`<div class=${`toast ${this.toast.tone}`} role=${this.toast.tone === 'bad' ? 'alert' : 'status'} data-rfq-toast>${tIcon(this.toast.tone === 'bad' ? 'warning' : 'check')}${this.toast.text}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-rfqs': TicketsRfqsPage;
  }
}
