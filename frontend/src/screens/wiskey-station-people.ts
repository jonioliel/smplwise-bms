import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { ApiError } from '../api/client';
import type { DisplayZone } from '../api/intercom';
import {
  adoptStationUser,
  checkStationUser,
  deleteStationUser,
  getStationScope,
  getStationUsers,
  ignoreStationUser,
  type StationCheckReply,
  type StationScopeRow,
  type StationUsersReply,
  type StationWriteReply,
  type StepOutcome,
} from '../api/station-people';
import {
  actionStations,
  adoptBlock,
  mergeStationUsers,
  resultTone,
  typedMatches,
  visibleRows,
  type MergedRow,
  type StationAction,
} from '../access-control/station-people-logic';
import { formatClock } from '../access-control/people-logic';
import { st, stDynamic, type StationPeopleKey } from '../i18n/station-people';
import { UTC_ZONE } from './wiskey-format';

/**
 * WISKEY-PEOPLE-COMPLETE-2390 (owner decision Q3 "a", 03.11): the "people on stations only" view of the people screen - users a door
 * station holds that are not in the people list, read station by station (each station's answer shows as it arrives; one that cannot
 * be read says why, never an empty list), one row per user number across the stations, and the administrator's three actions:
 * adopt (the person is created from the station user, or linked to the existing person with the same number - nothing is created on a
 * station), ignore (reversible) and delete from the station (typed confirmation). Every action has a confirmation step and shows one
 * honest result per station (done / refused / unknown / not sent). Events: `close`, `changed` (the people list may have changed),
 * `open-person` ({id}: show the adopted person).
 */
type Step = 'ask' | 'checking' | 'working' | 'done';

interface StationRead {
  loading: boolean;
  reply: StationUsersReply | null;
  error: string;
}

const OUTCOME_KEY: Record<StepOutcome, StationPeopleKey> = { ok: 'res_ok', refused: 'res_refused', unknown: 'res_unknown', not_sent: 'res_not_sent' };
const TITLE_KEY: Record<StationAction, StationPeopleKey> = { adopt: 'adopt_title', ignore: 'ignore_title', unignore: 'unignore_title', delete: 'delete_title' };

function reasonText(state: string | null | undefined, code: string | null | undefined): string {
  if (code === 'station_offline' || code === 'device_unavailable') return st('reason_offline');
  if (code === 'busy' || code === 'rate_limited') return st('reason_busy');
  if (state === 'forbidden') return st('reason_forbidden');
  if (state === 'unsupported') return st('reason_unsupported');
  return st('reason_generic');
}

@customElement('wiskey-station-people')
export class WiskeyStationPeople extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ attribute: false }) zone: DisplayZone = UTC_ZONE;

  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private feedDown = false;
  @state() private scope: StationScopeRow[] = [];
  @state() private reads: Record<string, StationRead> = {};
  @state() private query = '';
  @state() private showIgnored = false;
  @state() private acting: { row: MergedRow; action: StationAction } | null = null;
  @state() private step: Step = 'ask';
  @state() private check: StationCheckReply | null = null;
  @state() private checkFailed = false;
  @state() private acceptDuplicate = false;
  @state() private typed = '';
  @state() private reply: StationWriteReply | null = null;
  @state() private failure = '';
  private generation = 0;

  connectedCallback() {
    super.connectedCallback();
    if (this.open) void this.load(false);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.generation++;
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open && changed.get('open') === false) void this.load(false);
  }

  // ------------------------------------------------------------------ data

  private async load(refresh: boolean) {
    const generation = ++this.generation;
    this.phase = 'loading';
    try {
      const reply = await getStationScope();
      if (generation !== this.generation) return;
      this.scope = reply.stations;
      this.feedDown = reply.state !== 'ready' && !reply.stations.length;
      this.phase = 'ready';
    } catch {
      if (generation === this.generation) this.phase = 'error';
      return;
    }
    const readable = this.scope.filter((s) => s.numbers);
    this.reads = Object.fromEntries(readable.map((s) => [s.id, { loading: true, reply: this.reads[s.id]?.reply ?? null, error: '' }]));
    for (const s of readable) {
      if (generation !== this.generation) return;
      await this.readStation(s.id, refresh, generation);
    }
  }

  private async readStation(id: string, refresh: boolean, generation = this.generation) {
    this.reads = { ...this.reads, [id]: { ...(this.reads[id] ?? { reply: null, error: '' }), loading: true } };
    try {
      const reply = await getStationUsers(id, refresh);
      if (generation !== this.generation) return;
      this.reads = { ...this.reads, [id]: { loading: false, reply, error: reply.people ? '' : reasonText(reply.state, reply.last_error) } };
    } catch (err) {
      if (generation !== this.generation) return;
      const msg = err instanceof ApiError && err.status === 403 ? st('reason_forbidden') : st('reason_generic');
      this.reads = { ...this.reads, [id]: { loading: false, reply: null, error: msg } };
    }
  }

  private get rows(): MergedRow[] {
    const per = this.scope
      .filter((s) => this.reads[s.id]?.reply?.people)
      .map((s) => ({ station: { id: s.id, name: s.name }, people: this.reads[s.id]!.reply!.people }));
    return mergeStationUsers(per);
  }

  private get loadingAny(): boolean {
    return Object.values(this.reads).some((r) => r.loading);
  }

  private close() {
    if (this.step === 'working') return;
    this.acting = null;
    this.dispatchEvent(new CustomEvent('close'));
  }

  // ------------------------------------------------------------------ actions

  private startAction(row: MergedRow, action: StationAction) {
    this.acting = { row, action };
    this.step = 'ask';
    this.reply = null;
    this.failure = '';
    this.check = null;
    this.checkFailed = false;
    this.acceptDuplicate = false;
    this.typed = '';
    if (action === 'adopt') void this.runCheck(row);
  }

  private async runCheck(row: MergedRow) {
    const first = actionStations(row, 'adopt')[0];
    if (!first) return;
    this.step = 'checking';
    try {
      this.check = await checkStationUser(first.station_id, row.employee_no);
      this.checkFailed = !this.check.checked;
    } catch {
      this.checkFailed = true;
    } finally {
      if (this.step === 'checking') this.step = 'ask';
    }
  }

  private get possibleDuplicates(): number {
    const c = this.check;
    if (!c || !c.checked) return 0;
    return c.total - (c.same_number ? 1 : 0);
  }

  private canConfirm(): boolean {
    const a = this.acting;
    if (!a || this.step !== 'ask') return false;
    if (!actionStations(a.row, a.action).length) return false;
    if (a.action === 'adopt' && this.possibleDuplicates > 0 && !this.acceptDuplicate) return false;
    if (a.action === 'delete' && !typedMatches(this.typed, a.row.employee_no)) return false;
    return true;
  }

  private async confirm() {
    const a = this.acting;
    if (!a || !this.canConfirm()) return;
    const ids = actionStations(a.row, a.action).map((s) => s.station_id);
    this.step = 'working';
    this.failure = '';
    try {
      if (a.action === 'adopt') this.reply = await adoptStationUser(a.row.employee_no, ids, this.acceptDuplicate);
      else if (a.action === 'delete') this.reply = await deleteStationUser(a.row.employee_no, ids, this.typed.trim());
      else this.reply = await ignoreStationUser(a.row.employee_no, ids, a.action === 'ignore');
    } catch (err) {
      this.failure = err instanceof ApiError ? err.body.user_message || err.code : st('res_failed');
      this.reply = null;
    }
    this.step = 'done';
    if (this.reply && this.reply.summary.ok + this.reply.summary.unknown > 0) this.dispatchEvent(new CustomEvent('changed'));
    for (const id of ids) void this.readStation(id, a.action === 'adopt' || a.action === 'delete');
  }

  private closeAction() {
    if (this.step === 'working') return;
    this.acting = null;
  }

  // ------------------------------------------------------------------ render

  render() {
    if (!this.open) return nothing;
    const rows = this.rows;
    const shown = visibleRows(rows, this.showIgnored, this.query);
    const hiddenCount = rows.filter((r) => r.ignored).length;
    return html`<sw-dialog open xl heading=${st('title')} subheading=${this.phase === 'ready' && !this.loadingAny ? (rows.length === 1 ? st('count_one') : st('count', { n: rows.length })) : ''}
        data-station-people data-station-people-phase=${this.phase} data-station-people-loading=${String(this.loadingAny)}
        @close=${(e: Event) => { e.stopPropagation(); this.close(); }}>
        <p class="intro">${st('intro')}</p>
        ${this.phase === 'loading' ? html`<sw-state-panel state="loading" compact heading=${st('reading')}></sw-state-panel>` : nothing}
        ${this.phase === 'error' ? html`<sw-state-panel state="error" compact heading=${st('reason_generic')} data-station-people-error></sw-state-panel>` : nothing}
        ${this.phase === 'ready' && this.feedDown ? html`<sw-state-panel state="error" compact heading=${st('feed_down')} data-station-people-feed-down></sw-state-panel>` : nothing}
        ${this.phase === 'ready' && !this.feedDown && !this.scope.length ? html`<sw-state-panel icon="door" state="empty" compact heading=${st('no_stations')} data-station-people-noscope></sw-state-panel>` : nothing}
        ${this.phase === 'ready' && this.scope.length ? this.renderReady(shown, rows.length, hiddenCount) : nothing}
        <div slot="footer" class="footer">
          <sw-button variant="ghost" icon="refresh" data-station-people-refresh ?disabled=${this.loadingAny || this.phase === 'loading'} @click=${() => void this.load(true)}>${st('refresh')}</sw-button>
          <sw-button variant="secondary" data-station-people-close @click=${() => this.close()}>${st('close')}</sw-button>
        </div>
      </sw-dialog>
      ${this.acting ? this.renderAction() : nothing}`;
  }

  private renderReady(shown: MergedRow[], total: number, hiddenCount: number): TemplateResult {
    return html`
      <div class="tools">
        <label class="search"><sw-icon name="search" size=${16}></sw-icon>
          <input type="search" data-station-people-search maxlength="64" aria-label=${st('search')} placeholder=${st('search')} .value=${live(this.query)}
            @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} />
        </label>
        ${hiddenCount
          ? html`<label class="check"><input type="checkbox" data-station-people-show-ignored .checked=${this.showIgnored} @change=${(e: Event) => (this.showIgnored = (e.target as HTMLInputElement).checked)} />
              <span>${st('show_ignored')} (${hiddenCount})</span></label>`
          : nothing}
      </div>
      <ul class="status" aria-live="polite">
        ${this.scope.map((s) => {
          if (!s.numbers) return html`<li class="warn" data-station-people-station=${s.id} data-station-state="numbers_hidden"><sw-icon name="lock" size=${14}></sw-icon>${st('station_numbers_hidden', { name: s.name })}</li>`;
          const r = this.reads[s.id];
          if (!r || r.loading) return html`<li class="muted" data-station-people-station=${s.id} data-station-state="loading"><span class="dot"></span>${st('reading_station', { name: s.name })}</li>`;
          if (r.error) return html`<li class="warn" data-station-people-station=${s.id} data-station-state="error"><sw-icon name="warning" size=${14}></sw-icon>${st('station_off', { name: s.name, reason: r.error })}</li>`;
          return nothing;
        })}
      </ul>
      ${shown.length
        ? html`<ul class="rows" data-station-people-rows>${repeat(shown, (r) => r.employee_no, (r) => this.renderRow(r))}</ul>`
        : !this.loadingAny
          ? html`<sw-state-panel icon="users" state="empty" compact heading=${total ? st('empty_filtered') : st('empty')} data-station-people-empty></sw-state-panel>`
          : nothing}`;
  }

  private credentials(r: MergedRow): TemplateResult {
    if (r.pin === null && r.cards === null && r.biometric === null) return html`<span class="muted" title=${st('hidden_hint')}>${st('hidden')}</span>`;
    const parts: TemplateResult[] = [];
    if (r.pin) parts.push(html`<span class="chip" data-cred="pin"><sw-icon name="lock" size=${12}></sw-icon>${st('pin')}</span>`);
    if (r.cards) parts.push(html`<span class="chip" data-cred="cards"><sw-icon name="grid" size=${12}></sw-icon>${r.cards === 1 ? st('card') : st('cards', { n: r.cards })}</span>`);
    if (r.biometric) parts.push(html`<span class="chip" data-cred="face"><sw-icon name="user" size=${12}></sw-icon>${st('face')}</span>`);
    return parts.length ? html`${parts}` : html`<span class="muted">${st('none')}</span>`;
  }

  private renderRow(r: MergedRow): TemplateResult {
    const block = adoptBlock(r);
    const name = r.display_name || st('no_name');
    return html`<li class="row ${r.ignored ? 'ignored' : ''}" data-station-user=${r.employee_no} data-station-user-ignored=${String(r.ignored)}>
      <div class="who">
        <span class="name ${r.display_name ? '' : 'muted'}">${name}</span>
        <bdi class="num" dir="ltr" data-station-user-number>${r.employee_no}</bdi>
        ${r.ignored ? html`<sw-badge kind="neutral" label=${st('ignored_badge')}></sw-badge>` : nothing}
        ${r.names.length > 1 ? html`<span class="warn-text" data-station-user-names>${st('two_names')}: ${r.names.join(' · ')}</span>` : nothing}
      </div>
      <div class="facts">
        <span class="stations" aria-label=${st('col_stations')}>${r.stations.map((s) => html`<span class="chip station ${s.ignored ? 'off' : ''}" data-station-chip=${s.station_id}>${s.station_name}</span>`)}</span>
        <span class="creds" aria-label=${st('col_credentials')}>${this.credentials(r)}</span>
        <span class="seen muted" data-station-user-first-seen>${st('col_first_seen')}: ${formatClock(r.first_seen_at, this.zone)}</span>
      </div>
      <div class="acts">
        ${block
          ? html`<span class="muted small" data-station-user-block=${block}>${st('adopt_blocked')}: ${stDynamic(`imp_${block}`, 'imp_unknown')}</span>`
          : html`<sw-button size="sm" variant="primary" icon="plus" data-station-user-act="adopt" @click=${() => this.startAction(r, 'adopt')}>${st('act_adopt')}</sw-button>`}
        ${r.ignored
          ? html`<sw-button size="sm" variant="secondary" icon="eye" data-station-user-act="unignore" @click=${() => this.startAction(r, 'unignore')}>${st('act_unignore')}</sw-button>`
          : html`<sw-button size="sm" variant="secondary" icon="eye" data-station-user-act="ignore" @click=${() => this.startAction(r, 'ignore')}>${st('act_ignore')}</sw-button>`}
        <sw-button size="sm" variant="danger" icon="trash" data-station-user-act="delete" @click=${() => this.startAction(r, 'delete')}>${st('act_delete')}</sw-button>
      </div>
    </li>`;
  }

  private renderAction(): TemplateResult {
    const { row, action } = this.acting!;
    const targets = actionStations(row, action);
    const done = this.step === 'done';
    return html`<sw-dialog open heading=${st(TITLE_KEY[action])} subheading=${`${row.display_name || st('no_name')} · ${row.employee_no}`} ?locked=${this.step === 'working'}
        data-station-action=${action} data-station-action-step=${this.step} @close=${(e: Event) => { e.stopPropagation(); this.closeAction(); }}>
        ${done ? this.renderResult(action) : this.renderAsk(row, action, targets.map((t) => t.station_name))}
        <div slot="footer" class="footer">
          ${done
            ? html`${action === 'adopt' && this.reply?.person
                ? html`<sw-button variant="secondary" icon="user" data-station-action-open-person @click=${() => { const id = this.reply!.person!.id; this.acting = null; this.dispatchEvent(new CustomEvent('open-person', { detail: { id } })); }}>${st('res_open_person')}</sw-button>`
                : nothing}
              <sw-button variant="primary" data-station-action-close @click=${() => this.closeAction()}>${st('close')}</sw-button>`
            : html`<sw-button variant="ghost" data-station-action-cancel ?disabled=${this.step === 'working'} @click=${() => this.closeAction()}>${st('cancel')}</sw-button>
              <sw-button variant=${action === 'delete' ? 'danger' : 'primary'} data-station-action-confirm ?disabled=${!this.canConfirm()} @click=${() => void this.confirm()}>
                ${this.step === 'working' ? st('working') : action === 'adopt' ? st('adopt_go') : action === 'delete' ? st('delete_go') : st('confirm')}</sw-button>`}
        </div>
      </sw-dialog>`;
  }

  private renderAsk(row: MergedRow, action: StationAction, stationNames: string[]): TemplateResult {
    const text: StationPeopleKey = action === 'adopt' ? 'adopt_text' : action === 'delete' ? 'delete_text' : action === 'ignore' ? 'ignore_text' : 'unignore_text';
    return html`<p class="ask">${st(text)}</p>
      <p class="targets" data-station-action-targets>${st('stations_list')} ${stationNames.join(' · ')}</p>
      ${action === 'adopt' ? this.renderCheck() : nothing}
      ${action === 'delete'
        ? html`<sw-field label=${st('delete_type', { n: row.employee_no })}>
            <input data-station-action-typed dir="ltr" autocomplete="off" maxlength="64" .value=${live(this.typed)} @input=${(e: Event) => (this.typed = (e.target as HTMLInputElement).value)} />
          </sw-field>`
        : nothing}`;
  }

  private renderCheck(): TemplateResult {
    if (this.step === 'checking') return html`<p class="muted" role="status" data-station-check="checking">${st('adopt_checking')}</p>`;
    if (this.checkFailed) return html`<p class="warn-text" role="status" data-station-check="failed">${st('adopt_check_failed')}</p>`;
    const c = this.check;
    if (!c) return html``;
    const same = c.same_number;
    const maybe = this.possibleDuplicates;
    return html`${same
        ? html`<p class="note ok" data-station-check="link"><sw-icon name="link" size=${14}></sw-icon>${same.id ? st('adopt_link', { name: same.display_name }) : st('adopt_link_hidden')}</p>`
        : nothing}
      ${maybe > 0
        ? html`<div class="note warn" data-station-check="maybe">
            <p>${c.restricted ? st('adopt_maybe_hidden', { n: maybe }) : st('adopt_maybe')}</p>
            ${c.restricted
              ? nothing
              : html`<ul>${c.matches.filter((m) => !m.reasons.includes('employee_no')).map((m) => html`<li data-station-check-match=${m.id}>
                  <button type="button" class="link" @click=${() => { this.acting = null; this.dispatchEvent(new CustomEvent('open-person', { detail: { id: m.id } })); }}>${m.display_name}</button>
                  ${m.employee_no ? html`<bdi dir="ltr" class="muted">${m.employee_no}</bdi>` : nothing}</li>`)}</ul>`}
            <label class="check"><input type="checkbox" data-station-check-accept .checked=${this.acceptDuplicate} @change=${(e: Event) => (this.acceptDuplicate = (e.target as HTMLInputElement).checked)} />
              <span>${st('adopt_maybe_accept')}</span></label>
          </div>`
        : nothing}`;
  }

  private renderResult(action: StationAction): TemplateResult {
    if (this.failure || !this.reply) return html`<p class="result failed" role="status" data-station-result="failed">${this.failure || st('res_failed')}</p>`;
    const tone = resultTone(this.reply.results);
    const head: StationPeopleKey = tone === 'ok' ? (action === 'delete' ? 'res_pending' : 'res_all_ok') : tone === 'partial' ? 'res_partial' : tone === 'unknown' ? 'res_unknown_all' : 'res_failed';
    const names = Object.fromEntries(this.scope.map((s) => [s.id, s.name]));
    return html`<p class="result ${tone}" role="status" data-station-result=${tone}>${st(head)}</p>
      <ul class="per-station" data-station-results>
        ${this.reply.results.map((r) => html`<li data-station-result-row=${r.station_id} data-outcome=${r.outcome}>
          <span class="st">${names[r.station_id] ?? r.station_id}</span>
          <span class="oc ${r.outcome}">${st(OUTCOME_KEY[r.outcome])}</span>
          ${r.message ? html`<span class="msg">${r.message}</span>` : nothing}
          ${(action === 'ignore' || action === 'unignore') && r.stored && r.outcome !== 'ok' ? html`<span class="msg" data-station-result-stored-only>${st('res_stored_only')}</span>` : nothing}
        </li>`)}
      </ul>`;
  }

  static styles = css`
    :host {
      display: contents;
    }
    .intro,
    .ask,
    .targets {
      margin: 0 0 12px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .targets {
      color: var(--sw-text);
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: center;
      margin-block-end: 8px;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1 1 220px;
      min-block-size: 40px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text-2);
    }
    .search input {
      flex: 1;
      min-inline-size: 0;
      border: 0;
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: max(16px, var(--sw-fs-sm));
    }
    .search input:focus {
      outline: none;
    }
    .search:focus-within {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 40px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      cursor: pointer;
    }
    .check input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-accent);
    }
    .status {
      list-style: none;
      margin: 0 0 8px;
      padding: 0;
      display: grid;
      gap: 4px;
      font-size: var(--sw-fs-sm);
    }
    .status li {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-skeleton);
    }
    .warn,
    .warn-text {
      color: var(--sw-text);
    }
    .warn sw-icon {
      color: var(--sw-warning);
    }
    .warn-text {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      color: var(--sw-text-3);
    }
    .small {
      font-size: var(--sw-fs-xs);
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 2fr) auto;
      gap: 8px 16px;
      align-items: center;
      padding: 12px 14px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .row.ignored {
      background: var(--sw-surface-2);
    }
    .who {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 8px;
      min-inline-size: 0;
    }
    .name {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
      overflow-wrap: anywhere;
    }
    .num {
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
    }
    .stations,
    .creds {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    .chip.station {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .chip.station.off {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }
    .footer {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
      inline-size: 100%;
    }
    .note {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0 0 12px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    p.note {
      flex-direction: row;
      align-items: center;
    }
    .note p {
      margin: 0;
    }
    .note ul {
      margin: 0;
      padding-inline-start: 18px;
    }
    .note.ok {
      background: var(--sw-success-soft);
    }
    .note.warn {
      background: var(--sw-stale-soft);
    }
    .link {
      border: 0;
      padding: 4px 0;
      background: none;
      color: var(--sw-accent-text);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
    .result {
      margin: 0 0 10px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      background: var(--sw-surface-2);
    }
    .result.ok {
      background: var(--sw-success-soft);
    }
    .result.partial,
    .result.unknown {
      background: var(--sw-stale-soft);
    }
    .result.failed {
      background: var(--sw-danger-soft);
    }
    .per-station {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .per-station li {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 10px;
      align-items: baseline;
    }
    .per-station .st {
      font-weight: var(--sw-fw-semibold);
    }
    .oc {
      padding: 0 8px;
      border-radius: var(--sw-r-pill);
      font-weight: var(--sw-fw-semibold);
      background: var(--sw-surface-2);
    }
    .oc.ok {
      background: var(--sw-success-soft);
    }
    .oc.unknown {
      background: var(--sw-stale-soft);
    }
    .oc.refused,
    .oc.not_sent {
      background: var(--sw-danger-soft);
    }
    .msg {
      color: var(--sw-text-2);
      flex-basis: 100%;
    }
    input[data-station-action-typed] {
      font-size: max(16px, var(--sw-fs-sm));
    }
    @media (max-width: 767px) {
      .row {
        grid-template-columns: minmax(0, 1fr);
        padding: 12px;
      }
      .acts {
        justify-content: flex-start;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-station-people': WiskeyStationPeople;
  }
}
