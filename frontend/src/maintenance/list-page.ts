import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import '../components/sw-state-panel';
import '../components/sw-place-tree';
import '../components/sw-pager';
import '../components/sw-button';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import { PageFit } from '../components/page-fit';
import { liftRef } from '../components/top-layer';
import type { IconName } from '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import { PollController } from '../components/poll-controller';
import { maintApi, type Task, type TaskKind } from '../api/maintenance';
import { mt, type MtKey } from '../i18n/maintenance';
import type { MaintAccess } from './access';
import { PAGE_KINDS, PAGE_KPIS, applyFilter, badgeText, fmtDate, intervalText, kindText, kpiCounts, lastRunText, lookOf, segsOf, subLine, treeRows, type KpiKey, type ListPage, type Seg } from './model';
import { maintCss } from './styles';
import './task-sheet';
import './task-form';
import './vendor-card';
import './round-run';
import { ToastController } from '../components/toast-controller';

const COLLAPSED_KEY = 'sw.maintenance.collapsed';
/** CR-CMP2-TABLES-GENMAINT-2450 (owner N10): a row's state in the table is a shared tone chip (the phone cards keep the module badge) */
const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info' | undefined> = { ok: 'ok', warn: 'warn', alarm: 'bad', acc: 'info', unk: undefined };
const POLL_MS = 60_000;

function readCollapsed(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 200) : []);
  } catch {
    return new Set();
  }
}

const TEXT: Record<ListPage, { err: MtKey; empty: MtKey; emptyBody: MtKey; emptyBodyTickets: MtKey; add: MtKey; first: MtKey; icon: IconName }> = {
  ledger: { err: 'errLedger', empty: 'emptyLedger', emptyBody: 'emptyLedgerBody', emptyBodyTickets: 'emptyLedgerBody', add: 'newCert', first: 'firstCert', icon: 'inbox' },
  plans: { err: 'errPlans', empty: 'emptyPlans', emptyBody: 'emptyPlansBody', emptyBodyTickets: 'emptyPlansTickets', add: 'newPlan', first: 'firstPlan', icon: 'wrench' },
  rounds: { err: 'errRounds', empty: 'emptyRounds', emptyBody: 'emptyRoundsBody', emptyBodyTickets: 'emptyRoundsTickets', add: 'newRound', first: 'firstRound', icon: 'check' },
};

/**
 * One list page of the maintenance section (פנקס אישורים ובדיקות / תחזוקה מונעת / סבבים ובדיקות), drawn as the approved mockup v2:
 * the page head with its actions, the KPI row (each a filter), the places tree (a select on phones), the toolbar (segmented kind
 * control and search), the table (cards on phones) and its row actions. A row opens the task sheet (a supplier document: the
 * supplier's card); a round's start / continue replaces the list with the run (one checkpoint per screen). Manage-only affordances
 * are not rendered for an operator; with the tickets module off no request element is rendered at all.
 */
@customElement('maint-list-page')
export class MaintListPage extends LitElement {
  @property() page: ListPage = 'ledger';
  @property({ attribute: false }) access!: MaintAccess;
  /** `?task=<id>`: open that task's sheet once loaded */
  @property() openTask = '';
  /** `?run=<id>`: open that round run (a scanned round sticker lands here) */
  @property() openRun = '';
  @state() private items: Task[] | null = null;
  @state() private error = '';
  @state() private kpi: KpiKey = 'all';
  @state() private place = 'all';
  @state() private seg: Seg = 'all';
  @state() private q = '';
  @state() private collapsed = readCollapsed();
  @state() private sheet: string | null = null;
  @state() private sheetMode: 'view' | 'complete' = 'view';
  @state() private form: { kind: TaskKind; id: string | null } | null = null;
  @state() private vendor: string | null = null;
  @state() private run: string | null = null;
  /** CR-CMP2-TOAST-2440 (07:F12): the flash message and its one timer (stopped when the element leaves the page). */
  private readonly toaster = new ToastController(this, { ms: 2600 });
  private get toast(): string {
    return this.toaster.text;
  }
  /** CR-POLL-FEATURES-2439: the task list re-read every POLL_MS (not while a round or the form is open) - paused while the tab is hidden, never two at once, caught up on resume. */
  private poll = new PollController(this);
  private loadedFor = '';
  /** PAGING-SETTING-2439 (owner round 32, Q-SYS-5 a; code review 08:F23): on a desktop the table no longer scrolls inside its panel - the
   * rows that fit are page 1, the rest are on the next pages (the pager at the end of the toolbar). With the long lists set to scroll
   * (הגדרות › כללי) the table scrolls inside its panel as before. The phone's cards are unchanged. */
  private fit = new PageFit(this, () => this.renderRoot.querySelector<HTMLElement>('.scrollx'), () => !this.run && !!this.items?.length);
  /** CR-CMP2-TABLES-GENMAINT-2450: the module's narrow edge (1100 px, the electricity .hide-tablet rule) for the supplier, request and
   * last-run columns. The shared tablet width (1024 px) would keep them at 1024-1100 px, where the names then wrap to three lines and the
   * page of rows that fits the screen shrinks (1024 x 768: 4 rows instead of 5). */
  private readonly narrowMq = window.matchMedia('(max-width: 1100px)');
  @state() private narrow = this.narrowMq.matches;
  private readonly onNarrow = () => {
    this.narrow = this.narrowMq.matches;
  };

  static styles = [maintCss, css`
    :host { flex: 1; overflow: hidden; }
    /* the pager's place at the end of the toolbar is kept while the table fits the window (its height never moves the table) */
    .toolbar .pg { margin-inline-start: auto; min-inline-size: 150px; display: flex; justify-content: flex-end; }
    .fitsec { display: block; }
    /* CR-CMP2-TABLES-GENMAINT-2450 (owner N10): the list is the shared table inside the panel - the module's header band, reading size and
       row padding, never wider than the panel (a long name takes a second line; figures, chips and the row's key stay on one line) */
    sw-table[data-maint-table] { --sw-table-min: 0; --sw-table-head-bg: var(--sw-surface-2); --sw-table-fs: var(--sw-fs-md); --sw-table-cell-pad: 10px 12px; }
    sw-table[data-maint-table]::part(cell) { white-space: normal; }
    sw-table[data-maint-table]::part(cell-num), sw-table[data-maint-table]::part(cell-status), sw-table[data-maint-table]::part(cell-actions) { white-space: nowrap; }
    sw-table[data-maint-table]::part(request) { text-decoration: none; }
    sw-table[data-maint-table]::part(request):focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    @media (max-width: 1100px) { sw-table[data-maint-table] { --sw-table-cell-pad: 10px 8px; } }
    @media (min-width: 1024px) and (min-height: 560px) {
      :host([data-fit][data-long-lists='paged']) .cols > .panel.flush > .scrollx { overflow-y: hidden; }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    this.narrowMq.addEventListener('change', this.onNarrow);
    this.narrow = this.narrowMq.matches;
    this.poll.every('tasks', POLL_MS, () => this.load(), { when: () => !this.run && !this.form });
  }

  disconnectedCallback() {
    this.narrowMq.removeEventListener('change', this.onNarrow);
    super.disconnectedCallback();
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('page') && this.loadedFor !== this.page) {
      this.loadedFor = this.page;
      this.items = null;
      this.error = '';
      this.kpi = 'all';
      this.seg = 'all';
      this.place = 'all';
      this.run = null;
      void this.load();
    }
    if (changed.has('openTask') && this.openTask && this.items) this.openById(this.openTask);
    if (changed.has('openRun') && this.openRun) this.run = this.openRun;
    this.toggleAttribute('data-fit', this.fit.fits);
  }

  private async load() {
    try {
      const kinds = PAGE_KINDS[this.page];
      const lists = await Promise.all(kinds.map((k) => maintApi.tasks({ kind: k, include_inactive: true })));
      const first = !this.items;
      this.items = lists.flatMap((l) => l.items);
      this.error = '';
      if (first && this.openTask) this.openById(this.openTask);
    } catch (e) {
      if (!this.items) this.error = describeError(e);
    }
  }

  private flash(msg: string) {
    this.toaster.show(msg);
  }

  private openById(id: string) {
    const t = this.items?.find((x) => x.id === id);
    if (t?.kind === 'vendor_document' && t.vendor_id) this.vendor = t.vendor_id;
    else this.sheet = id;
    this.sheetMode = 'view';
  }

  private openRow(t: Task) {
    if (t.kind === 'vendor_document' && t.vendor_id) {
      this.vendor = t.vendor_id;
      return;
    }
    this.sheetMode = 'view';
    this.sheet = t.id;
  }

  private async act(t: Task, e: Event) {
    e.stopPropagation();
    try {
      if (!t.active) {
        await maintApi.update(t.id, { active: true, revision: t.revision });
        this.flash(mt('resumedToast'));
      } else if (t.kind === 'round') {
        if (t.open_run) this.run = t.open_run.id;
        else this.run = (await maintApi.startRun(t.id)).id;
        return;
      } else if (t.kind === 'preventive') {
        await maintApi.complete(t.id, { revision: t.revision });
        this.flash(mt('doneToast'));
      } else {
        this.sheetMode = 'complete';
        this.sheet = t.id;
        return;
      }
      await this.load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const runId = (err.body?.details as { run_id?: string } | undefined)?.run_id;
        if (runId) {
          this.run = runId;
          return;
        }
        this.flash(mt('conflict'));
        await this.load();
        return;
      }
      this.flash(describeError(err));
    }
  }

  /** The row action a viewer may take (none = nothing rendered): renew (manage), mark done (perform), start / continue (perform), resume (manage). */
  private action(t: Task, shared = false): TemplateResult | typeof nothing {
    const a = this.access;
    let label: MtKey | null = null;
    let pri = false;
    if (!t.active) label = a.manage ? 'resume' : null;
    else if (t.kind === 'round') {
      label = a.perform ? (t.open_run ? 'continue' : 'start') : null;
      pri = !!t.open_run;
    } else if (t.kind === 'preventive') label = a.perform ? 'markDone' : null;
    else label = a.manage ? 'renew' : null;
    if (!label) return nothing;
    // CR-CMP2-TABLES-GENMAINT-2450: in the table the key is the shared button (a screen's .btn does not reach the table's shadow root)
    if (shared) return html`<sw-button size="sm" variant=${pri ? 'primary' : 'secondary'} data-maint-act=${label} data-task=${t.id} @click=${(e: Event) => void this.act(t, e)}>${mt(label)}</sw-button>`;
    return html`<button type="button" class="btn sm ${pri ? 'pri' : ''}" data-maint-act=${label} data-task=${t.id} @click=${(e: Event) => void this.act(t, e)}>${mt(label)}</button>`;
  }

  private requestCell(t: Task): TemplateResult {
    if (t.ticket_id) return html`<a class="chip" data-look="acc" href=${`#/tickets/${encodeURIComponent(t.ticket_id)}`} data-maint-ticket=${t.ticket_id} @click=${(e: Event) => e.stopPropagation()}>${mt('requestOpen')}</a>`;
    if (t.auto_ticket) return html`<span class="chip">${mt('autoRequest')}</span>`;
    return html`<span class="mut">${mt('dash')}</span>`;
  }

  private placeName(t: Task) {
    return t.place?.name || '';
  }

  private kindCell(t: Task): string {
    const iv = intervalText(t.interval);
    return [kindText(t.kind), iv].filter(Boolean).join(' · ');
  }

  /** CR-CMP2-TABLES-GENMAINT-2450 (owner N10): the request cell in the table - the open request (a shared chip link), the automatic
   * request (a neutral chip) or a dash */
  private requestTableCell(t: Task): TemplateResult {
    if (t.ticket_id) return html`<a class="chip" part="request" data-tone="info" data-nodot href=${`#/tickets/${encodeURIComponent(t.ticket_id)}`} data-maint-ticket=${t.ticket_id} @click=${(e: Event) => e.stopPropagation()}>${mt('requestOpen')}</a>`;
    if (t.auto_ticket) return html`<span class="chip" data-nodot>${mt('autoRequest')}</span>`;
    return html`<span class="mut">${mt('dash')}</span>`;
  }

  /** CR-CMP2-TABLES-GENMAINT-2450 (owner N10): the list's columns per page - the state (a shared tone chip), the name (with its sub line),
   * the kind / interval, the place, the supplier, the next date and the row's key; the supplier, the request and the last run step out
   * at the module's narrow edge (1100 px, `narrow`) */
  private columns(): TableColumn<Task>[] {
    const p = this.page;
    const dash = html`<span class="mut">${mt('dash')}</span>`;
    const state: TableColumn<Task> = { key: 'state', label: mt('colState'), kind: 'status', render: (t) => html`<span class="chip" data-tone=${TONE[lookOf(t)] ?? nothing} data-maint-badge>${badgeText(t)}</span>` };
    const name: TableColumn<Task> = { key: 'title', label: mt(p === 'ledger' ? 'colName' : p === 'plans' ? 'colPlan' : 'colRound'), render: (t) => html`<span class="t1">${t.title}</span>${subLine(t) ? html`<span class="t2">${subLine(t)}</span>` : nothing}` };
    const place: TableColumn<Task> = { key: 'place', label: mt('colPlace'), render: (t) => this.placeName(t) || dash };
    const wide = !this.narrow;
    const vendor: TableColumn<Task>[] = wide ? [{ key: 'vendor', label: mt('colVendor'), render: (t) => t.vendor_name || dash }] : [];
    const due: TableColumn<Task> = { key: 'due', label: mt(p === 'ledger' ? 'colValidUntil' : 'colNext'), render: (t) => (t.due_date && t.active ? html`<span class="num">${fmtDate(t.due_date)}</span>` : dash) };
    const act: TableColumn<Task> = { key: 'act', label: '', kind: 'actions', render: (t) => this.action(t, true) };
    if (p === 'ledger') return [state, name, { key: 'kind', label: mt('colKind'), render: (t) => this.kindCell(t) }, place, ...vendor, due, act];
    const interval: TableColumn<Task> = { key: 'interval', label: mt(p === 'plans' ? 'colInterval' : 'colFreq'), render: (t) => intervalText(t.interval) };
    const request: TableColumn<Task>[] = this.access.ticketsOn && wide ? [{ key: 'request', label: mt('colRequest'), render: (t) => this.requestTableCell(t) }] : [];
    if (p === 'plans') return [state, name, interval, place, ...vendor, due, ...request, act];
    return [state, name, interval, place, { key: 'points', label: mt('colPoints'), kind: 'num', render: (t) => String(t.checklist_count) },
      ...(wide ? [{ key: 'last', label: mt('colLastRun'), render: (t: Task) => lastRunText(t) || dash }] : []), due, act];
  }

  private card(t: Task): TemplateResult {
    const parts = this.page === 'rounds'
      ? [intervalText(t.interval), this.placeName(t), lastRunText(t), t.due_date ? fmtDate(t.due_date) : '']
      : [this.page === 'ledger' ? this.kindCell(t) : intervalText(t.interval), this.placeName(t), t.vendor_name ?? '', t.due_date && t.active ? fmtDate(t.due_date) : ''];
    const action = this.action(t);
    return html`<div class="c" role="button" tabindex="0" data-look=${lookOf(t)} data-maint-card=${t.id} @click=${() => this.openRow(t)}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openRow(t); } }}>
      <div class="r1"><span class="t1">${t.title}</span><span class="badge">${badgeText(t)}</span></div>
      <div class="mut">${parts.filter(Boolean).join(' · ')}</div>
      ${action !== nothing || (this.page === 'plans' && this.access.ticketsOn && t.ticket_id) ? html`<div class="r3">${action}${this.page === 'plans' && this.access.ticketsOn && t.ticket_id ? this.requestCell(t) : nothing}</div>` : nothing}
    </div>`;
  }

  private toggleFold(id: string) {
    const next = new Set(this.collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.collapsed = next;
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {
      /* per-browser convenience only */
    }
  }

  private top(list: Task[]): TemplateResult {
    const late = list.filter((t) => lookOf(t) === 'alarm').length;
    const kind: TaskKind = this.page === 'ledger' ? 'certificate' : this.page === 'plans' ? 'preventive' : 'round';
    return html`<div class="top"><div><h1>${mt(`page${this.page[0].toUpperCase()}${this.page.slice(1)}` as MtKey)}</h1>
        <p class="sub" data-maint-sub>${mt('section')} · ${list.length ? mt('subCount', { n: list.length, late }) : mt('subEmpty')}</p></div><span class="sp"></span>
      <div class="meta">
        ${this.access.manage ? html`<button type="button" class="btn pri" data-maint-new=${kind} @click=${() => { this.form = { kind, id: null }; }}><sw-icon name="plus" size="16"></sw-icon>${mt(TEXT[this.page].add)}</button>` : nothing}
      </div></div>`;
  }

  private overlays(): TemplateResult {
    return html`
      ${this.sheet ? html`<maint-task-sheet .taskId=${this.sheet} .mode=${this.sheetMode} .access=${this.access} @close=${() => { this.sheet = null; }}
          @changed=${(e: CustomEvent<string>) => { this.flash(e.detail); void this.load(); }} @removed=${(e: CustomEvent<string>) => { this.sheet = null; this.flash(e.detail); void this.load(); }}
          @edit=${(e: CustomEvent<{ kind: TaskKind; id: string }>) => { this.sheet = null; this.form = e.detail; }}
          @start-run=${(e: CustomEvent<string>) => { this.sheet = null; this.run = e.detail; }}
          @open-vendor=${(e: CustomEvent<string>) => { this.sheet = null; this.vendor = e.detail; }}></maint-task-sheet>` : nothing}
      ${this.form ? html`<maint-task-form .kind=${this.form.kind} .taskId=${this.form.id} .ticketsOn=${this.access.ticketsOn} @close=${() => { this.form = null; }}
          @saved=${(e: CustomEvent<{ id: string; text: string }>) => { this.form = null; this.flash(e.detail.text); void this.load(); }}></maint-task-form>` : nothing}
      ${this.vendor ? html`<maint-vendor-card .vendorId=${this.vendor} .access=${this.access} @close=${() => { this.vendor = null; }}
          @open-task=${(e: CustomEvent<{ id: string; mode: 'view' | 'complete' }>) => { this.vendor = null; this.sheetMode = e.detail.mode; this.sheet = e.detail.id; }}
          @new-document=${(e: CustomEvent<string>) => { this.vendor = null; this.form = { kind: 'vendor_document', id: null }; this.pendingVendor = e.detail; }}></maint-vendor-card>` : nothing}
      ${this.toast ? html`<div class="toast" role="status" aria-live="polite" ${liftRef() /* DIALOG-TOPLAYER-2381: above the task sheet's open sw-dialog */}>${this.toast}</div>` : nothing}`;
  }

  /** the supplier a "new document" from the supplier card is for (the form preselects it) */
  private pendingVendor = '';

  protected updated() {
    if (this.pendingVendor) {
      const f = this.renderRoot.querySelector('maint-task-form');
      if (f) {
        f.presetVendor = this.pendingVendor;
        this.pendingVendor = '';
      }
    }
  }

  render() {
    const t = TEXT[this.page];
    if (this.run) {
      return html`<maint-round-run .runId=${this.run} .access=${this.access} @close=${() => { this.run = null; void this.load(); }}
        @done=${(e: CustomEvent<string>) => { this.run = null; this.flash(e.detail); void this.load(); }}></maint-round-run>${this.overlays()}`;
    }
    if (!this.items) {
      return this.error
        ? html`<sw-state-panel state="error" heading=${mt(t.err)} hint=${mt('errHint')} actionLabel=${mt('retry')} data-state="error" @action=${() => { this.error = ''; void this.load(); }}></sw-state-panel>`
        : html`<div class="top"><div><h1>${mt(`page${this.page[0].toUpperCase()}${this.page.slice(1)}` as MtKey)}</h1></div></div><div class="skl" aria-busy="true" aria-label=${mt('loading')} data-state="loading"></div>`;
    }
    const list = this.items;
    if (!list.length) {
      return html`${this.top(list)}
        <sw-state-panel icon=${t.icon} state="empty" heading=${mt(t.empty)} hint=${mt(this.access.ticketsOn ? t.emptyBodyTickets : t.emptyBody)} data-state="empty">
          ${this.access.manage ? html`<button type="button" class="btn pri" data-maint-first @click=${() => { this.form = { kind: this.page === 'ledger' ? 'certificate' : this.page === 'plans' ? 'preventive' : 'round', id: null }; }}><sw-icon name="plus" size="16"></sw-icon>${mt(t.first)}</button>` : nothing}
        </sw-state-panel>${this.overlays()}`;
    }
    const { shown, base } = applyFilter(list, { kpi: this.kpi, place: this.place, seg: this.seg, q: this.q });
    const n = kpiCounts(base);
    const rows = treeRows(list.filter((x) => applyFilter([x], { kpi: 'all', place: 'all', seg: this.seg, q: this.q }).shown.length), this.collapsed);
    const segs = segsOf(this.page, this.access.ticketsOn);
    this.fit.sync(shown.length, `${this.page}|${shown.map((r) => r.id).join(',')}`);
    return html`${this.top(list)}
      <div class="kpis" role="group" aria-label=${mt('kpiStatus')} data-maint-kpis>
        ${PAGE_KPIS[this.page].map((k) => html`<button type="button" class="kpi" data-k=${k.key} data-look=${k.key === 'all' ? nothing : k.key} aria-pressed=${String(this.kpi === k.key)} data-maint-kpi=${k.key}
            @click=${() => { this.kpi = this.kpi === k.key || k.key === 'all' ? 'all' : k.key; }}><span class="dot" aria-hidden="true"></span><div><b>${n[k.key]}</b><span class="l">${mt(k.label)}</span></div></button>`)}
      </div>
      <div class="cols">
        <aside class="panel flush tree-w"><sw-place-tree .rows=${rows} .selected=${this.place} heading=${mt('places')} foldLabel=${mt('fold')} unfoldLabel=${mt('unfold')} data-maint-tree
          @place-select=${(e: CustomEvent<string>) => { this.place = e.detail; }} @place-toggle=${(e: CustomEvent<string>) => this.toggleFold(e.detail)}></sw-place-tree></aside>
        <div class="panel flush">
          <div class="tree-m"><select aria-label=${mt('place')} data-maint-place-select @change=${(e: Event) => { this.place = (e.target as HTMLSelectElement).value; }}>
            ${treeRows(list).map((r) => html`<option value=${r.id} ?selected=${r.id === this.place}>${r.depth ? '– ' : ''}${r.name} (${r.count})</option>`)}</select></div>
          <div class="toolbar">
            ${segs.length ? html`<sw-segmented label=${mt(this.page === 'ledger' ? 'kindFilter' : this.page === 'plans' ? 'requestFilter' : 'freqFilter')} data-maint-segs value=${this.seg} @change=${(e: CustomEvent<SegmentedChange>) => { this.seg = e.detail.value as typeof this.seg; }}
              .options=${segs.map((s) => ({ value: s.key, label: mt(s.label), attrs: { 'data-seg': s.key } }))}></sw-segmented>` : nothing}
            <label class="search"><sw-icon name="search" size="14"></sw-icon><input type="search" placeholder=${mt('search')} aria-label=${mt('search')} .value=${this.q} data-maint-search
              @input=${(e: Event) => { this.q = (e.target as HTMLInputElement).value; }}></label>
            ${this.fit.fits ? html`<span class="pg">${this.fit.pages > 1 ? html`<sw-pager data-maint-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${(e: CustomEvent<{ page: number }>) => this.fit.go(e.detail.page)}></sw-pager>` : nothing}</span>` : nothing}
          </div>
          ${shown.length ? html`
            <div class="scrollx"><section class="fitsec"><sw-table bare data-maint-table .columns=${this.columns() as unknown as TableColumn[]}
              .rows=${shown.filter((_, i) => this.fit.shows(i)) as unknown as Record<string, unknown>[]}
              .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-fit-item': true, 'data-maint-row': String(r.id), 'data-look': lookOf(r as unknown as Task) })}
              @row-select=${(e: CustomEvent<{ row: Record<string, unknown> }>) => this.openRow(e.detail.row as unknown as Task)}></sw-table></section></div>
            <div class="cards-m" data-maint-cards>${shown.map((r) => this.card(r))}</div>`
            : html`<div class="nomatch" data-maint-nomatch>${mt('noMatch')}</div>`}
        </div>
      </div>
      ${this.overlays()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'maint-list-page': MaintListPage;
  }
}
