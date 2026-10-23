import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { can, isApi } from '../api/session';
import { LOG_EVENTS, maintApi, type LogEvent, type LogRow, type ReminderLog } from '../api/maintenance';
import { mt, type MtKey } from '../i18n/maintenance';
import type { MaintAccess } from './access';
import { fmtDate, fmtInstant, kindText } from './model';
import { maintCss } from './styles';

const LOOK: Record<LogEvent, string> = { due_soon: 'warn', overdue: 'alarm', request: 'acc', request_failed: 'alarm' };

/**
 * The reminder log (owner review 24.10): what the worker sent - a reminder before a date, a reminder after it passed, a service
 * request a plan opened, a request that could not be opened - newest first, filtered by type. Only tasks the caller may see. It fills
 * the height of the screen and the list scrolls INSIDE its panel (control screens never scroll as a page). When reminders are still off
 * the page says so with a way to the setting. The server keeps the log for the number of days set in Settings.
 */
@customElement('maint-log-page')
export class MaintLogPage extends LitElement {
  @property({ attribute: false }) access!: MaintAccess;
  @state() private log: ReminderLog | null = null;
  @state() private error = '';
  @state() private event: LogEvent | '' = '';
  private timer?: number;

  static styles = [maintCss, css`
    :host { flex: 1; min-block-size: 0; }
    .fill { display: flex; flex-direction: column; flex: 1; min-block-size: 0; }
    .panel.flush.fill { min-block-size: 0; }
    .scroller { flex: 1; min-block-size: 0; overflow: auto; }
    .evt { display: inline-flex; align-items: center; gap: 6px; }
    .evt .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c, var(--sw-accent)); flex: none; }
    [data-look='warn'] { --c: var(--sw-warning); }
    [data-look='alarm'] { --c: var(--sw-danger); }
    [data-look='acc'] { --c: var(--sw-accent); }
    a.task { color: var(--sw-accent-text); text-decoration: none; font-weight: var(--sw-fw-semibold); }
    a.task:hover { text-decoration: underline; }
    .note { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-block-end: 1px solid var(--sw-border); background: var(--sw-warning-soft); }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void this.load();
    }, 60_000);
  }

  disconnectedCallback() {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
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

  private row(r: LogRow) {
    return html`<tr data-maint-log-row=${r.id} data-event=${r.event}>
      <td class="date num">${fmtInstant(r.at)}</td>
      <td><span class="evt" data-look=${LOOK[r.event]}><span class="dot" aria-hidden="true"></span>${mt(`evt_${r.event}` as MtKey)}</span></td>
      <td class="name"><a class="task" href=${`#/tickets/maintenance?task=${encodeURIComponent(r.task_id)}`}>${r.title}</a><span class="t2">${kindText(r.task_kind)}</span></td>
      <td class="date num">${r.due_date ? fmtDate(r.due_date) : html`<span class="mut">${mt('dash')}</span>`}</td>
      <td>${r.event === 'request' && r.detail && this.access.ticketsOn ? html`<a class="chip" data-look="acc" href=${`#/tickets/${encodeURIComponent(r.detail)}`}>${mt('requestOpen')}</a>` : r.event === 'request_failed' && r.detail ? html`<span class="mut">${mt(`ticketErr_${r.detail}` as MtKey) === `ticketErr_${r.detail}` ? r.detail : mt(`ticketErr_${r.detail}` as MtKey)}</span>` : nothing}</td>
    </tr>`;
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
    return html`${head(sub)}
      <div class="panel flush fill" data-maint-log>
        ${off ? html`<div class="note" role="status" data-maint-log-off><sw-icon name="bell" size="16"></sw-icon><div><b>${mt('logOffTitle')}</b> ${mt('logOffBody')}</div><span class="sp"></span>
          ${!isApi() || can('system.configure') ? html`<a class="btn sm" href="#/system/infra/maintenance" data-maint-to-settings>${mt('logToSettings')}</a>` : nothing}</div>` : nothing}
        <div class="toolbar"><div class="seg" role="group" aria-label=${mt('evtFilter')} data-maint-log-filter>
          <button type="button" aria-pressed=${String(this.event === '')} data-ev="all" @click=${() => this.pick('')}>${mt('colAll')}</button>
          ${LOG_EVENTS.map((e) => html`<button type="button" aria-pressed=${String(this.event === e)} data-ev=${e} @click=${() => this.pick(e)}>${mt(`evt_${e}` as MtKey)}</button>`)}</div></div>
        ${l.items.length ? html`<div class="scroller">
            <div class="scrollx"><table class="t" data-maint-log-table><thead><tr><th>${mt('colWhen')}</th><th>${mt('colEvent')}</th><th>${mt('colTaskName')}</th><th>${mt('colDueDate')}</th><th></th></tr></thead>
              <tbody>${l.items.map((r) => this.row(r))}</tbody></table></div>
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
