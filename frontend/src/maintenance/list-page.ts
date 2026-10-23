import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-place-tree';
import type { IconName } from '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import { maintApi, type Task, type TaskKind } from '../api/maintenance';
import { mt, type MtKey } from '../i18n/maintenance';
import type { MaintAccess } from './access';
import { PAGE_KINDS, PAGE_KPIS, applyFilter, badgeText, fmtDate, intervalText, kindText, kpiCounts, lastRunText, lookOf, segsOf, subLine, treeRows, type KpiKey, type ListPage, type Seg } from './model';
import { maintCss } from './styles';
import './task-sheet';
import './task-form';
import './vendor-card';
import './round-run';

const COLLAPSED_KEY = 'sw.maintenance.collapsed';
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
  @state() private toast = '';
  private timer?: number;
  private loadedFor = '';

  static styles = [maintCss, css`:host { flex: 1; overflow: hidden; }`];

  connectedCallback() {
    super.connectedCallback();
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !this.run && !this.form) void this.load();
    }, POLL_MS);
  }

  disconnectedCallback() {
    window.clearInterval(this.timer);
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
    this.toast = msg;
    window.setTimeout(() => {
      if (this.toast === msg) this.toast = '';
    }, 2600);
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
  private action(t: Task): TemplateResult | typeof nothing {
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

  private head(): TemplateResult[] {
    const p = this.page;
    const cols: [MtKey, string?][] =
      p === 'ledger' ? [['colState'], ['colName'], ['colKind'], ['colPlace'], ['colVendor', 'hide-tablet'], ['colValidUntil']]
        : p === 'plans' ? [['colState'], ['colPlan'], ['colInterval'], ['colPlace'], ['colVendor', 'hide-tablet'], ['colNext'], ...(this.access.ticketsOn ? [['colRequest', 'hide-tablet'] as [MtKey, string]] : [])]
          : [['colState'], ['colRound'], ['colFreq'], ['colPlace'], ['colPoints'], ['colLastRun', 'hide-tablet'], ['colNext']];
    return [...cols.map(([k, cls]) => html`<th class=${cls ?? ''}>${mt(k)}</th>`), html`<th><span class="mut" hidden>-</span></th>`];
  }

  private cells(t: Task): TemplateResult {
    const dash = html`<span class="mut">${mt('dash')}</span>`;
    const name = html`<td class="name"><span class="t1">${t.title}</span>${subLine(t) ? html`<span class="t2">${subLine(t)}</span>` : nothing}</td>`;
    const state = html`<td><span class="badge" data-maint-badge>${badgeText(t)}</span></td>`;
    const place = html`<td>${this.placeName(t) || dash}</td>`;
    const vendor = html`<td class="hide-tablet">${t.vendor_name || dash}</td>`;
    const due = html`<td class="date num">${t.due_date && t.active ? fmtDate(t.due_date) : dash}</td>`;
    const act = html`<td class="act">${this.action(t)}</td>`;
    if (this.page === 'ledger') return html`${state}${name}<td>${this.kindCell(t)}</td>${place}${vendor}${due}${act}`;
    if (this.page === 'plans') return html`${state}${name}<td>${intervalText(t.interval)}</td>${place}${vendor}${due}${this.access.ticketsOn ? html`<td class="hide-tablet">${this.requestCell(t)}</td>` : nothing}${act}`;
    return html`${state}${name}<td>${intervalText(t.interval)}</td>${place}<td class="num">${t.checklist_count}</td><td class="hide-tablet date">${lastRunText(t) || dash}</td>${due}${act}`;
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
      ${this.toast ? html`<div class="toast" role="status" aria-live="polite">${this.toast}</div>` : nothing}`;
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
            ${segs.length ? html`<div class="seg" role="group" aria-label=${mt(this.page === 'ledger' ? 'kindFilter' : this.page === 'plans' ? 'requestFilter' : 'freqFilter')} data-maint-segs>
              ${segs.map((s) => html`<button type="button" aria-pressed=${String(this.seg === s.key)} data-seg=${s.key} @click=${() => { this.seg = s.key; }}>${mt(s.label)}</button>`)}</div>` : nothing}
            <label class="search"><sw-icon name="search" size="14"></sw-icon><input type="search" placeholder=${mt('search')} aria-label=${mt('search')} .value=${this.q} data-maint-search
              @input=${(e: Event) => { this.q = (e.target as HTMLInputElement).value; }}></label>
          </div>
          ${shown.length ? html`
            <div class="scrollx"><table class="t" data-maint-table><thead><tr>${this.head()}</tr></thead><tbody>
              ${shown.map((r) => html`<tr class="go" tabindex="0" data-look=${lookOf(r)} data-maint-row=${r.id} @click=${() => this.openRow(r)}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openRow(r); } }}>${this.cells(r)}</tr>`)}
            </tbody></table></div>
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
