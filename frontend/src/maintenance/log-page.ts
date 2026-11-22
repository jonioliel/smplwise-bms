import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import '../components/sw-state-panel';
import '../components/sw-pager';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import { PageFit } from '../components/page-fit';
import { describeError } from '../api/client';
import { PollController } from '../components/poll-controller';
import { can, isApi } from '../api/session';
import { LOG_EVENTS, maintApi, type LogEvent, type LogRow, type ReminderLog } from '../api/maintenance';
import { mt, type MtKey } from '../i18n/maintenance';
import type { MaintAccess } from './access';
import { fmtDate, fmtInstant, kindText } from './model';
import { maintCss } from './styles';

const LOOK: Record<LogEvent, string> = { due_soon: 'warn', overdue: 'alarm', request: 'acc', request_failed: 'alarm' };
/** CR-CMP2-TABLES-GENMAINT-2450 (owner N10): the event's shared tone in the table (the phone cards keep the module look above) */
const TONE: Record<LogEvent, 'warn' | 'bad' | 'info'> = { due_soon: 'warn', overdue: 'bad', request: 'info', request_failed: 'bad' };

/**
 * The reminder log (owner review 24.10): what the worker sent - a reminder before a date, a reminder after it passed, a service
 * request a plan opened, a request that could not be opened - newest first, filtered by type. Only tasks the caller may see. It fills
 * the height of the screen and never scrolls as a page; on a desktop the log is split into pages (CR-NOSCROLL-LISTS-2443), with the
 * long lists set to scroll it scrolls INSIDE its panel. When reminders are still off
 * the page says so with a way to the setting. The server keeps the log for the number of days set in Settings.
 */
@customElement('maint-log-page')
export class MaintLogPage extends LitElement {
  @property({ attribute: false }) access!: MaintAccess;
  @state() private log: ReminderLog | null = null;
  @state() private error = '';
  @state() private event: LogEvent | '' = '';
  /** CR-POLL-FEATURES-2439: the reminder-log re-read every 60 s - paused while the tab is hidden, never two at once, caught up on resume. */
  private poll = new PollController(this);
  /** CR-NOSCROLL-LISTS-2443 (code review 08:F23, owner decision O12 = a; owner round 32 Q-SYS-5 a): the log holds up to 200 rows and
   * scrolled inside its panel (about 7 rows fit at 1366x768). On a desktop the rows that fit are page 1, the rest are on the next pages
   * (the pager at the end of the toolbar, as on the maintenance lists). The long lists set to scroll (הגדרות › כללי): the table scrolls
   * inside its panel as before. The phone's cards are unchanged. */
  private fit = new PageFit(this, () => this.renderRoot.querySelector<HTMLElement>('.scroller'), () => !!this.log?.items.length);

  static styles = [maintCss, css`
    :host { flex: 1; min-block-size: 0; }
    .fill { display: flex; flex-direction: column; flex: 1; min-block-size: 0; }
    .panel.flush.fill { min-block-size: 0; }
    .scroller { flex: 1; min-block-size: 0; overflow: auto; }
    .fitsec { display: block; }
    /* the pager's place at the end of the toolbar (as on the maintenance lists) */
    .toolbar .pg { margin-inline-start: auto; min-inline-size: 150px; display: flex; justify-content: flex-end; }
    @media screen and (min-width: 1024px) and (min-height: 560px) {
      :host([data-fit][data-long-lists='paged']) .scroller { overflow: hidden; }
    }
    .evt { display: inline-flex; align-items: center; gap: 6px; }
    .evt .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c, var(--sw-accent)); flex: none; }
    [data-look='warn'] { --c: var(--sw-warning); }
    [data-look='alarm'] { --c: var(--sw-danger); }
    [data-look='acc'] { --c: var(--sw-accent); }
    a.task { color: var(--sw-accent-text); text-decoration: none; font-weight: var(--sw-fw-semibold); }
    @media (hover: hover) and (pointer: fine) { a.task:hover { text-decoration: underline; } }
    /* CR-CMP2-TABLES-GENMAINT-2450 (owner N10): the log is the shared table inside the panel - the module's header band and reading size,
       never wider than the panel; the links in its cells (drawn in the table's shadow root) reach their look through parts */
    sw-table[data-maint-log-table] { --sw-table-min: 0; --sw-table-head-bg: var(--sw-surface-2); --sw-table-fs: var(--sw-fs-md); --sw-table-cell-pad: 10px 12px; }
    sw-table[data-maint-log-table]::part(task) { color: var(--sw-accent-text); text-decoration: none; font-weight: var(--sw-fw-semibold); }
    sw-table[data-maint-log-table]::part(request) { text-decoration: none; }
    sw-table[data-maint-log-table]::part(task):focus-visible, sw-table[data-maint-log-table]::part(request):focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; border-radius: 4px; }
    @media (hover: hover) and (pointer: fine) { sw-table[data-maint-log-table]::part(task):hover { text-decoration: underline; } }
    .note { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-block-end: 1px solid var(--sw-border); background: var(--sw-warning-soft); }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    this.poll.every('log', 60_000, () => this.load());
  }

  protected willUpdate() {
    this.toggleAttribute('data-fit', this.fit.fits);
  }

  private async load() {
    try {
      this.log = await maintApi.reminderLog({ event: this.event || undefined, limit: 200 });
      this.error = '';
    } catch (e) {
      if (!this.log) this.error = describeError(e);
    }
  }

  private pick(e: LogEvent | '') {
    this.event = e;
    void this.load();
  }

  /** CR-CMP2-TABLES-GENMAINT-2450 (owner N10): the log columns - when, the event (a shared tone chip), the task (its link and kind), the
   * due date, and the request (its link, or why it was not opened) */
  private columns(): TableColumn<LogRow>[] {
    const dash = html`<span class="mut">${mt('dash')}</span>`;
    return [
      { key: 'at', label: mt('colWhen'), render: (r) => html`<span class="num">${fmtInstant(r.at)}</span>` },
      { key: 'event', label: mt('colEvent'), kind: 'status', render: (r) => html`<span class="chip" data-tone=${TONE[r.event]}>${mt(`evt_${r.event}` as MtKey)}</span>` },
      { key: 'title', label: mt('colTaskName'), render: (r) => html`<a class="t1" part="task" href=${`#/tickets/maintenance?task=${encodeURIComponent(r.task_id)}`}>${r.title}</a><span class="t2">${kindText(r.task_kind)}</span>` },
      { key: 'due', label: mt('colDueDate'), render: (r) => (r.due_date ? html`<span class="num">${fmtDate(r.due_date)}</span>` : dash) },
      { key: 'detail', label: '', render: (r) => this.detailCell(r) },
    ];
  }

  private detailCell(r: LogRow) {
    if (r.event === 'request' && r.detail && this.access.ticketsOn) return html`<a class="chip" part="request" data-tone="info" data-nodot href=${`#/tickets/${encodeURIComponent(r.detail)}`}>${mt('requestOpen')}</a>`;
    if (r.event === 'request_failed' && r.detail) {
      const key = `ticketErr_${r.detail}` as MtKey;
      return html`<span class="mut">${mt(key) === key ? r.detail : mt(key)}</span>`;
    }
    return nothing;
  }

  private card(r: LogRow) {
    return html`<div class="c" data-maint-log-card=${r.id} data-look=${LOOK[r.event]}>
      <div class="r1"><a class="t1 task" href=${`#/tickets/maintenance?task=${encodeURIComponent(r.task_id)}`}>${r.title}</a><span class="mut num">${fmtInstant(r.at)}</span></div>
      <div class="evt" data-look=${LOOK[r.event]}><span class="dot" aria-hidden="true"></span>${mt(`evt_${r.event}` as MtKey)}${r.due_date ? html`<span class="mut"> · ${fmtDate(r.due_date)}</span>` : nothing}</div>
    </div>`;
  }

  render() {
    const head = (sub: string) => html`<div class="top"><div><h1>${mt('pageLog')}</h1><p class="sub" data-maint-sub>${mt('section')} · ${sub}</p></div></div>`;
    if (!this.log) {
      return this.error
        ? html`<sw-state-panel state="error" heading=${mt('errLog')} hint=${mt('errHint')} actionLabel=${mt('retry')} data-state="error" @action=${() => { this.error = ''; void this.load(); }}></sw-state-panel>`
        : html`${head('')}<div class="skl" aria-busy="true" aria-label=${mt('loading')} data-state="loading"></div>`;
    }
    const l = this.log;
    const off = !l.reminders_enabled;
    const sub = l.items.length ? mt('logSub', { n: l.items.length, k: l.keep_days }) : mt('logSubEmpty');
    this.fit.sync(l.items.length, `${this.event}|${l.items.map((r) => r.id).join(',')}`);
    return html`${head(sub)}
      <div class="panel flush fill" data-maint-log>
        ${off ? html`<div class="note" role="status" data-maint-log-off><sw-icon name="bell" size="16"></sw-icon><div><b>${mt('logOffTitle')}</b> ${mt('logOffBody')}</div><span class="sp"></span>
          ${!isApi() || can('system.configure') ? html`<a class="btn sm" href="#/system/infra/maintenance" data-maint-to-settings>${mt('logToSettings')}</a>` : nothing}</div>` : nothing}
        <div class="toolbar"><sw-segmented label=${mt('evtFilter')} data-maint-log-filter value=${this.event} @change=${(e: CustomEvent<SegmentedChange>) => this.pick(e.detail.value as LogEvent | '')}
          .options=${[{ value: '', label: mt('colAll'), attrs: { 'data-ev': 'all' } }, ...LOG_EVENTS.map((ev) => ({ value: ev, label: mt(`evt_${ev}` as MtKey), attrs: { 'data-ev': ev } }))]}></sw-segmented>
          ${this.fit.fits ? html`<span class="pg">${this.fit.pages > 1 ? html`<sw-pager data-maint-log-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${(e: CustomEvent<{ page: number }>) => this.fit.go(e.detail.page)}></sw-pager>` : nothing}</span>` : nothing}</div>
        ${l.items.length ? html`<div class="scroller">
            <div class="scrollx"><section class="fitsec"><sw-table bare static-rows data-maint-log-table .columns=${this.columns() as unknown as TableColumn[]}
              .rows=${l.items.filter((_, i) => this.fit.shows(i)) as unknown as Record<string, unknown>[]}
              .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-fit-item': true, 'data-maint-log-row': String(r.id), 'data-event': String(r.event) })}></sw-table></section></div>
            <div class="cards-m">${l.items.map((r) => this.card(r))}</div></div>`
          : html`<sw-state-panel icon="bell" state="empty" heading=${mt('emptyLog')} hint=${mt('emptyLogBody')} data-state="empty"></sw-state-panel>`}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'maint-log-page': MaintLogPage;
  }
}
