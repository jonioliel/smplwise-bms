import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ticketsApi, type ModuleState } from '../api/tickets';
import { session } from '../api/session';
import { ownNumbers, overviewSettingsOf, showsOwnNumbers, type OwnNumbers } from './overview-model';
import { ot } from './overview-text';

/**
 * MGRDASH phase 1 (owner decision 2026-10-17, question 4 answer b): a handler sees HIS OWN numbers - a quiet row of four tiles at the
 * top of "שלי": open with me, waiting for me, overdue, arrivals today. Counted from the "שלי" list of the server (the requests assigned to
 * the viewer; a creator's own requests do not count) - no other person's number is ever read. The setting `ui.dash_handler_numbers`
 * ("managers" = only managers) hides it from a handler; nothing is drawn while he holds no open request (not a handler). `everyone`
 * shows the same own numbers in phase 1: the team numbers for every handler need a server route that phase 1 does not add.
 */
@customElement('tickets-my-numbers')
export class TicketsMyNumbers extends LitElement {
  @property({ attribute: false }) module: ModuleState | null = null;
  @property({ type: Boolean }) manager = false;
  /** the list's own rows (a new array after each refresh / change), so the row follows the list */
  @property({ attribute: false }) source: unknown = null;
  @state() private n: OwnNumbers | null = null;
  private seq = 0;

  static styles = css`
    :host { display: block; }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sw-s-3); }
    .kpi { display: flex; flex-direction: column; gap: 2px; padding: 10px 16px; border-radius: var(--sw-r-xl); border: 1px solid var(--dv-border); background: var(--dv-surface); -webkit-backdrop-filter: var(--dv-surface-blur); backdrop-filter: var(--dv-surface-blur); box-shadow: var(--dv-shadow-1); min-inline-size: 0; }
    .kpi small { font-size: var(--sw-fs-sm); color: var(--dv-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .kpi b { font-size: var(--sw-fs-xl); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--dv-text); direction: ltr; unicode-bidi: isolate; text-align: start; }
    .kpi.warn b { color: var(--au-warn-text); }
    .kpi.bad b { color: var(--dv-danger); }
    @media (max-width: 767px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
  `;

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('module') || changed.has('source') || changed.has('manager')) void this.load();
  }

  private allowed(): boolean {
    return !!this.module?.enabled && showsOwnNumbers(overviewSettingsOf(this.module.ui as unknown as Record<string, unknown>), this.manager);
  }

  private async load(): Promise<void> {
    const uid = session.me?.user.id;
    const seq = ++this.seq;
    if (!this.allowed() || !uid) {
      this.n = null;
      return;
    }
    try {
      const page = await ticketsApi().list({ scope: 'mine', status: 'open', limit: 200 });
      if (seq === this.seq) this.n = ownNumbers(page.items, uid, new Date());
    } catch {
      if (seq === this.seq) this.n = null; // the row is optional: a failure draws nothing (the list says what went wrong)
    }
  }

  render() {
    const n = this.n;
    if (!n || !this.allowed() || n.open === 0) return nothing;
    return html`<div class="kpis" role="group" aria-label=${ot('myGroup')} data-my-numbers>
      <div class="kpi" data-my="open"><small>${ot('myOpen')}</small><b>${n.open}</b></div>
      <div class=${`kpi${n.waiting ? ' warn' : ''}`} data-my="waiting"><small>${ot('myWaiting')}</small><b>${n.waiting}</b></div>
      <div class=${`kpi${n.overdue ? ' bad' : ''}`} data-my="overdue"><small>${ot('myOverdue')}</small><b>${n.overdue}</b></div>
      <div class="kpi" data-my="visits"><small>${ot('myVisits')}</small><b>${n.visitsToday}</b></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-my-numbers': TicketsMyNumbers;
  }
}
