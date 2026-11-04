import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-dialog';
import '../components/sw-icon';
import '../components/sw-state-panel';
import type { RouteState } from '../router';
import { ApiError, describeError } from '../api/client';
import { isApi } from '../api/session';
import type { DisplayZone } from '../api/intercom';
import {
  getCompare, getCompareDoors, getDiagHome, getDiagOptions, getLifecycle, getPermissionAudit, getQuality, getReviewPreview, getReviews, getScenario,
  getSyncDiag, postDecide,
  type Comparison, type DiagHead, type DiagHome, type DiagOption, type DoorComparison, type Lifecycle, type LifeRow, type PermissionAudit, type PreviewReply,
  type QualityPage, type ReviewRow, type ReviewsPage, type ScenarioReply, type SyncDiag,
} from '../api/access-diag';
import {
  CADENCES, REVIEW_STATES, VIEWS, WINDOWS, cleanReason, dayText, diagHref, diffText, doorChoices, doorLabel, expiringFirst, instantText, issueText,
  parseDoorKey, relationText, relationTone, remainingText, reviewTone, rowsByStation, scenarioLines, sourceText, validityText, viewOf, viewState,
  type DiagView, type DoorChoice,
} from '../access-control/access-diag-logic';
import { fromLocalInput } from './wiskey-format';
import { dateInputLang } from '../api/day-format';
import { deepLinkHref } from '../wiskey/deep-links';
import { dt, dtDyn } from '../i18n/access-diag';

type Load = 'idle' | 'loading' | 'ready' | 'error';
type CompareKind = 'person' | 'group' | 'doors';
interface Picked {
  id: string;
  name: string;
}

/** "יאבד גישה בעוד ..." of a temporary person whose access ends inside the window (their own end date; WisKey gives no seconds here). */
function remainingTextOf(r: LifeRow): string {
  const end = r.valid_until ? Date.parse(r.valid_until) : NaN;
  return Number.isFinite(end) ? `${dt('expiring')} ${remainingText(Math.round((end - Date.now()) / 1000))}` : dt('expiring');
}

const PANEL_FOR: Partial<Record<DiagView, string>> = {
  reviews: 'access.reviews', compare: 'access.compare', quality: 'people.quality', lifecycle: 'people.lifecycle', audit: 'audit.panel', scenario: 'people.unmanaged', sync: 'sync.run',
};

/**
 * WISKEY-ACCESS-DIAG-2400 (plan 2026-11-03 T10): "אבחון הרשאות" (`#/wiskey/access-diag[?view=...]`) - the access-control system's own
 * diagnostics, natively in Arx, reached from the people screen and the stations and doors screen:
 *  - "האם יכול לפתוח": a person, a door and an optional time -> yes / no with the system's explanation (its reason, where the grant comes
 *    from, validity, schedule, holidays, the station, the sync evidence). A prediction from the central policy: the physical door is not
 *    checked;
 *  - "השוואה": two people, two groups or two doors;
 *  - "סקירות תקופתיות": one door's review list; "סקירה" opens one person's review, and where the system allows the Arx identity and the
 *    operator manages people at that station, records a decision after a confirmation (else view only, with the panel link);
 *  - "איכות נתונים", "פג תוקף בקרוב" (who loses access in the next N days), "ביקורת עמדה" (a station's device users vs the system's, read
 *    only), "סנכרון" (the sync workers' state).
 * The server decides every permission and drops what nobody may see (PINs, card numbers, phones); this screen shapes itself from the answers.
 */
@customElement('wiskey-access-diag')
export class WiskeyAccessDiag extends LitElement {
  @property({ attribute: false }) route: RouteState | null = null;

  @state() private view: DiagView = 'scenario';
  @state() private home: DiagHome | null = null;
  @state() private homeLoad: 'loading' | 'ready' | 'error' | 'forbidden' = 'loading';
  @state() private homeError = '';
  @state() private load: Load = 'idle';
  @state() private error = '';
  @state() private head: DiagHead | null = null;
  // scenario
  @state() private person: Picked | null = null;
  @state() private door = '';
  @state() private whenMode: 'now' | 'at' = 'now';
  @state() private whenValue = '';
  @state() private timeError = '';
  @state() private scenario: ScenarioReply | null = null;
  // pickers (one per slot: scenario, compare-left, compare-right)
  @state() private queries: Record<string, string> = {};
  @state() private options: Record<string, DiagOption[]> = {};
  @state() private openPicker = '';
  // compare
  @state() private cmpKind: CompareKind = 'person';
  @state() private left: Picked | null = null;
  @state() private right: Picked | null = null;
  @state() private leftDoor = '';
  @state() private rightDoor = '';
  @state() private comparison: Comparison | null = null;
  @state() private doorComparison: DoorComparison | null = null;
  // reviews
  @state() private reviewDoor = '';
  @state() private reviewState = 'all';
  @state() private reviews: ReviewsPage | null = null;
  @state() private reviewOffset = 0;
  @state() private openReview: ReviewRow | null = null;
  @state() private preview: PreviewReply | null = null;
  @state() private previewError = '';
  @state() private decision: 'keep' | 'followup' = 'keep';
  @state() private reason = '';
  @state() private cadence = 90;
  @state() private confirming = false;
  @state() private saving = false;
  @state() private decideLine: { ok: boolean; text: string } | null = null;
  // quality
  @state() private qKind = 'all';
  @state() private qState = 'current';
  @state() private quality: QualityPage | null = null;
  // lifecycle
  @state() private days = 30;
  @state() private lifecycle: Lifecycle | null = null;
  // audit
  @state() private auditStation = '';
  @state() private audit: PermissionAudit | null = null;
  // sync
  @state() private sync: SyncDiag | null = null;

  private seq = 0;
  private searchTimer = 0;

  static styles = css`
    :host {
      display: block;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .views {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .views a {
      display: inline-flex;
      align-items: center;
      min-block-size: 44px;
      padding-inline: 14px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
    }
    .views a[aria-current='page'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .views a:hover:not([aria-current='page']) {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .views a:focus-visible,
    a.link:focus-visible,
    button:focus-visible,
    select:focus-visible,
    input:focus-visible,
    textarea:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      min-inline-size: 0;
    }
    .card h2 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
      gap: 12px;
      align-items: end;
    }
    label.f {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      position: relative;
    }
    input,
    select,
    textarea {
      min-block-size: 44px;
      box-sizing: border-box;
      inline-size: 100%;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    textarea {
      min-block-size: 72px;
      padding-block: 8px;
      resize: vertical;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .acts.end {
      justify-content: flex-end;
    }
    .seg {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .seg button {
      min-block-size: 44px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .picker-list {
      position: absolute;
      inset-block-start: calc(100% + 4px);
      inset-inline: 0;
      z-index: var(--sw-z-drawer);
      margin: 0;
      padding: 4px;
      list-style: none;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
    }
    .picker-list button {
      display: flex;
      inline-size: 100%;
      min-block-size: 44px;
      align-items: center;
      gap: 8px;
      padding-inline: 8px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: none;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
    }
    .picker-list button:hover {
      background: var(--sw-surface-2);
    }
    .picker-list .none {
      padding: 8px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .chosen {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 44px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .chosen span {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chosen button {
      display: inline-grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: none;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .verdict {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: var(--sw-r-md);
    }
    .verdict.ok {
      background: var(--sw-success-soft);
    }
    .verdict.bad {
      background: var(--sw-danger-soft);
    }
    .verdict b {
      display: block;
      font-size: var(--sw-fs-lg);
    }
    .verdict .sub,
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .verdict.ok sw-icon {
      color: var(--sw-success);
    }
    .verdict.bad sw-icon {
      color: var(--sw-danger);
    }
    dl.lines {
      display: grid;
      grid-template-columns: minmax(6rem, max-content) 1fr;
      gap: 8px 14px;
      margin: 0;
    }
    dl.lines dt {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    dl.lines dd {
      margin: 0;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      flex: none;
      background: var(--sw-text-3);
    }
    .dot.ok {
      background: var(--sw-success);
    }
    .dot.bad {
      background: var(--sw-danger);
    }
    .dot.warn {
      background: var(--sw-warning);
    }
    .note {
      margin: 0;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .note.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .note.ok {
      background: var(--sw-success-soft);
      color: var(--sw-text);
    }
    ul.rows {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    ul.rows > li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    ul.rows > li:last-child {
      border-block-end: 0;
    }
    .name {
      flex: 1 1 10rem;
      min-inline-size: 0;
      font-weight: var(--sw-fw-medium);
      overflow-wrap: anywhere;
    }
    .detail {
      flex-basis: 100%;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      overflow-wrap: anywhere;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
      gap: 8px;
    }
    .kpi {
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    .kpi b {
      display: block;
      font-size: var(--sw-fs-xl);
      font-variant-numeric: tabular-nums;
    }
    .kpi span {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    h3 {
      margin: 4px 0 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    a.link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .side {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 12px;
      flex-basis: 100%;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .side b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }
    .radio {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 40px;
      font-size: var(--sw-fs-sm);
    }
    .radio input {
      inline-size: 18px;
      min-block-size: 18px;
      block-size: 18px;
    }
    sw-button {
      min-block-size: 44px;
    }
    @media (max-width: 560px) {
      dl.lines {
        grid-template-columns: 1fr;
        gap: 2px;
      }
      dl.lines dd {
        margin-block-end: 8px;
      }
      .side {
        grid-template-columns: 1fr;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadHome();
  }

  disconnectedCallback(): void {
    window.clearTimeout(this.searchTimer);
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('route')) {
      const next = viewOf(this.route?.params);
      if (next !== this.view) {
        this.view = next;
        this.resetView();
        if (this.homeLoad === 'ready') this.autoLoad();
      }
    }
  }

  private resetView(): void {
    this.seq++;
    this.load = 'idle';
    this.error = '';
    this.head = null;
    this.openPicker = '';
  }

  private get zone(): DisplayZone | null {
    return this.home?.default_zone ?? null;
  }

  private get doors(): DoorChoice[] {
    return doorChoices(this.home?.doors);
  }

  private async loadHome(): Promise<void> {
    this.homeLoad = 'loading';
    if (!isApi()) {
      this.homeLoad = 'forbidden';
      return;
    }
    try {
      this.home = await getDiagHome();
      this.view = viewOf(this.route?.params);
      const first = this.doors[0]?.key ?? '';
      this.door ||= first;
      this.reviewDoor ||= first;
      this.leftDoor ||= first;
      this.rightDoor ||= this.doors[1]?.key ?? first;
      this.auditStation ||= this.home.doors?.find((s) => s.online)?.id ?? '';
      this.homeLoad = 'ready';
      this.autoLoad();
    } catch (err) {
      this.homeLoad = err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error';
      this.homeError = describeError(err);
    }
  }

  /** The views that read on their own when opened (a list, not a question). */
  private autoLoad(): void {
    if (viewState(this.home, this.view) !== 'ok') return;
    if (this.view === 'reviews' && this.reviewDoor) void this.loadReviews(0);
    else if (this.view === 'quality') void this.loadQuality(0);
    else if (this.view === 'lifecycle') void this.loadLifecycle();
    else if (this.view === 'sync') void this.loadSync();
  }

  /** One read of the current view: the reply head says whether it ran; an HTTP error is shown as is. */
  private async run<T extends DiagHead>(fetch: () => Promise<T>, take: (r: T) => boolean): Promise<void> {
    const mine = ++this.seq;
    this.load = 'loading';
    this.error = '';
    try {
      const r = await fetch();
      if (mine !== this.seq) return;
      this.head = r;
      if (r.state !== 'ready' || !take(r)) {
        this.load = 'error';
        this.error = r.state === 'unsupported' || r.state === 'forbidden' ? dt('unsupported') : dt('unavailable');
        return;
      }
      this.load = 'ready';
    } catch (err) {
      if (mine !== this.seq) return;
      this.load = 'error';
      this.error = err instanceof ApiError && err.code === 'diag_unsupported' ? dt('unsupported') : describeError(err);
    }
  }

  // ---------------------------------------------------------------- the pickers

  private search(slot: string, kind: 'person' | 'group', text: string): void {
    this.queries = { ...this.queries, [slot]: text };
    this.openPicker = slot;
    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(async () => {
      try {
        const r = await getDiagOptions(kind, text.trim(), 0, 8);
        if (this.queries[slot] !== text) return;
        this.options = { ...this.options, [slot]: r.options?.records ?? [] };
      } catch {
        this.options = { ...this.options, [slot]: [] };
      }
    }, 250);
  }

  private renderPicker(slot: string, kind: 'person' | 'group', value: Picked | null, set: (p: Picked | null) => void, label: string): TemplateResult {
    if (value) {
      return html`<label class="f">${label}
        <span class="chosen" data-diag-chosen=${slot}><span>${value.name || value.id}</span>
          <button type="button" aria-label=${dt('pickPerson')} @click=${() => set(null)}><sw-icon name="close" size=${16}></sw-icon></button></span></label>`;
    }
    const list = this.options[slot];
    return html`<label class="f">${label}
      <input type="search" data-diag-picker=${slot} autocomplete="off" placeholder=${kind === 'person' ? dt('personPh') : dt('groupPh')} .value=${this.queries[slot] ?? ''}
        @input=${(e: Event) => this.search(slot, kind, (e.target as HTMLInputElement).value)} @focus=${() => this.search(slot, kind, this.queries[slot] ?? '')}
        @keydown=${(e: KeyboardEvent) => e.key === 'Escape' && (this.openPicker = '')} />
      ${this.openPicker === slot && list
        ? html`<ul class="picker-list" role="listbox" data-diag-options=${slot}>
            ${list.length
              ? list.map((o) => html`<li role="option" aria-selected="false"><button type="button" data-diag-option=${o.id}
                  @click=${() => { set({ id: o.id, name: o.name }); this.openPicker = ''; }}>${o.name || o.id}${o.archived ? html`<span class="muted">· ${dt('person_archived')}</span>` : nothing}</button></li>`)
              : html`<li class="none">${dt('noMatches')}</li>`}
          </ul>`
        : nothing}
    </label>`;
  }

  private renderDoorSelect(label: string, value: string, set: (v: string) => void, attr: string): TemplateResult {
    return html`<label class="f">${label}
      <select data-diag-door=${attr} .value=${value} @change=${(e: Event) => set((e.target as HTMLSelectElement).value)}>
        ${this.doors.map((d) => html`<option value=${d.key} ?selected=${d.key === value}>${d.label}${d.online ? '' : ` · ${dt('stationOffline')}`}</option>`)}
      </select></label>`;
  }

  // ---------------------------------------------------------------- render

  render(): TemplateResult {
    const title = dt('title');
    if (this.homeLoad === 'loading') return html`<sw-page heading=${title}><sw-state-panel state="loading" heading=${dt('loading')} data-diag-state="loading"></sw-state-panel></sw-page>`;
    if (this.homeLoad === 'forbidden') {
      return html`<sw-page heading=${title}><sw-state-panel quiet state="forbidden" heading=${dt('noPermission')} hint=${dt('noPermissionHint')} data-diag-state="forbidden"></sw-state-panel></sw-page>`;
    }
    if (this.homeLoad === 'error' || !this.home) {
      return html`<sw-page heading=${title}><sw-state-panel state="error" heading=${dt('loadError')} hint=${this.homeError} actionLabel=${dt('retry')} @action=${() => void this.loadHome()}
        data-diag-state="error"></sw-state-panel></sw-page>`;
    }
    return html`<sw-page wide heading=${title} subheading=${dt('sub')} data-diag data-diag-state="ready" data-diag-view=${this.view}>
      <div class="stack">
        <nav class="views" aria-label=${dt('views')} data-diag-views>
          ${VIEWS.map((v) => html`<a href=${diagHref(v)} data-diag-tab=${v} aria-current=${v === this.view ? 'page' : 'false'}>${dtDyn(`v_${v}`, 'title')}</a>`)}
        </nav>
        ${this.renderView()}
      </div>
      ${this.renderReviewDialog()}
    </sw-page>`;
  }

  private renderView(): TemplateResult {
    const st = viewState(this.home, this.view);
    const panel = PANEL_FOR[this.view];
    if (st === 'unsupported') {
      return html`<div class="card" data-diag-unsupported=${this.view}><p class="note">${dt('unsupported')}</p>
        ${panel ? html`<a class="link" href=${deepLinkHref(panel)} data-diag-panel>${dt('openPanel')}</a>` : nothing}</div>`;
    }
    if (st === 'people') return html`<div class="card" data-diag-people-needed><p class="note">${dt('peopleNeeded')}</p></div>`;
    switch (this.view) {
      case 'scenario':
        return this.renderScenario();
      case 'compare':
        return this.renderCompare();
      case 'reviews':
        return this.renderReviews();
      case 'quality':
        return this.renderQuality();
      case 'lifecycle':
        return this.renderLifecycle();
      case 'audit':
        return this.renderAudit();
      default:
        return this.renderSync();
    }
  }

  private status(): TemplateResult | typeof nothing {
    if (this.load === 'loading') return html`<sw-state-panel compact state="loading" heading=${dt('loading')} data-diag-loading></sw-state-panel>`;
    if (this.load === 'error') return html`<p class="note bad" role="alert" data-diag-error>${this.error}</p>`;
    return nothing;
  }

  private fetched(): TemplateResult | typeof nothing {
    const at = this.head?.fetched_at;
    return at ? html`<span class="muted" data-diag-fetched>${dt('fetched', { t: instantText(at, this.zone) })}</span>` : nothing;
  }

  // ---------------------------------------------------------------- scenario

  private async check(): Promise<void> {
    const door = parseDoorKey(this.door);
    if (!this.person || !door) return;
    let at: string | null = null;
    this.timeError = '';
    if (this.whenMode === 'at') {
      try {
        at = fromLocalInput(this.whenValue, this.zone ?? undefined);
      } catch (e) {
        const code = (e as Error).message;
        this.timeError = code === 'clock_ambiguous' ? dt('timeAmbiguous') : code === 'clock_nonexistent' ? dt('timeMissing') : dt('timeInvalid');
        return;
      }
      if (!at) {
        this.timeError = dt('timeInvalid');
        return;
      }
    }
    const person = this.person;
    await this.run(() => getScenario(person.id, door.station_id, door.lock_id, at), (r) => {
      this.scenario = r;
      return !!r.scenario;
    });
  }

  private renderScenario(): TemplateResult {
    const r = this.load === 'ready' ? this.scenario : null;
    return html`<section class="card" data-diag-scenario>
        <div class="form">
          ${this.renderPicker('scenario', 'person', this.person, (p) => (this.person = p), dt('person'))}
          ${this.renderDoorSelect(dt('door'), this.door, (v) => (this.door = v), 'scenario')}
          <div class="f">
            <span class="muted">${dt('when')}</span>
            <div class="seg" role="group" aria-label=${dt('when')}>
              <button type="button" aria-pressed=${String(this.whenMode === 'now')} data-diag-when="now" @click=${() => (this.whenMode = 'now')}>${dt('now')}</button>
              <button type="button" aria-pressed=${String(this.whenMode === 'at')} data-diag-when="at" @click=${() => (this.whenMode = 'at')}>${dt('atTime')}</button>
            </div>
          </div>
          ${this.whenMode === 'at'
            ? html`<label class="f">${dt('atTime')}<input type="datetime-local" lang=${dateInputLang()} data-diag-at .value=${this.whenValue}
                @input=${(e: Event) => (this.whenValue = (e.target as HTMLInputElement).value)} /></label>`
            : nothing}
        </div>
        ${this.timeError ? html`<p class="note bad" role="alert" data-diag-time-error>${this.timeError}</p>` : nothing}
        <div class="acts">
          <sw-button variant="primary" icon="search" data-diag-check ?disabled=${!this.person || !this.door || this.load === 'loading'} @click=${() => void this.check()}>
            ${this.load === 'loading' ? dt('checking') : dt('check')}</sw-button>
          <span class="muted">${dt('readOnly')}</span>
        </div>
      </section>
      ${this.status()}
      ${r && r.scenario ? this.renderAnswer(r) : nothing}`;
  }

  private renderAnswer(r: ScenarioReply): TemplateResult {
    const s = r.scenario!;
    const ok = s.desired.allowed;
    const door = r.station ? (r.station.door_name ? dt('doorNamed', { station: r.station.name, door: r.station.door_name }) : doorLabel(this.home?.doors, s.station_id, s.lock_id)) : '—';
    const lines = scenarioLines(s, r.station, this.zone);
    return html`<section class="card" data-diag-answer=${ok ? 'yes' : 'no'} data-diag-reason=${s.desired.reason} aria-live="polite">
      <div class="verdict ${ok ? 'ok' : 'bad'}">
        <sw-icon name=${ok ? 'check' : 'lock'} size=${28}></sw-icon>
        <div><b>${ok ? dt('yes') : dt('no')}</b>
          <span class="sub">${dt('answerFor', { person: s.person?.name || this.person?.name || '—', door, at: instantText(s.at, this.zone) })}</span></div>
      </div>
      <dl class="lines">
        ${lines.map((l) => html`<dt data-diag-line=${l.id}><span class="dot ${l.tone}"></span>${l.label}</dt><dd>${l.text}</dd>`)}
      </dl>
      <p class="note">${dt('notPhysical')}</p>
      <div class="acts">${this.fetched()}</div>
    </section>`;
  }

  // ---------------------------------------------------------------- compare

  private async compare(): Promise<void> {
    this.comparison = null;
    this.doorComparison = null;
    if (this.cmpKind === 'doors') {
      await this.run(() => getCompareDoors(this.leftDoor, this.rightDoor), (r) => {
        this.doorComparison = r.doors;
        return !!r.doors;
      });
      return;
    }
    if (!this.left || !this.right) return;
    const kind = this.cmpKind;
    const [a, b] = [this.left.id, this.right.id];
    await this.run(() => getCompare(kind, a, b), (r) => {
      this.comparison = r.compare;
      return !!r.compare;
    });
  }

  private setKind(k: CompareKind): void {
    if (k === this.cmpKind) return;
    this.cmpKind = k;
    this.left = null;
    this.right = null;
    this.comparison = null;
    this.doorComparison = null;
    this.resetView();
  }

  private renderCompare(): TemplateResult {
    const k = this.cmpKind;
    const ready = k === 'doors' ? this.leftDoor && this.rightDoor && this.leftDoor !== this.rightDoor : !!(this.left && this.right);
    return html`<section class="card" data-diag-compare=${k}>
        <div class="seg" role="group" aria-label=${dt('compareKind')}>
          ${(['person', 'group', 'doors'] as CompareKind[]).map((x) => html`<button type="button" aria-pressed=${String(k === x)} data-diag-kind=${x}
            @click=${() => this.setKind(x)}>${dt(x === 'person' ? 'k_people' : x === 'group' ? 'k_groups' : 'k_doors')}</button>`)}
        </div>
        <div class="form">
          ${k === 'doors'
            ? html`${this.renderDoorSelect(dt('first'), this.leftDoor, (v) => (this.leftDoor = v), 'left')}${this.renderDoorSelect(dt('second'), this.rightDoor, (v) => (this.rightDoor = v), 'right')}`
            : html`${this.renderPicker('left', k, this.left, (p) => (this.left = p), dt('first'))}${this.renderPicker('right', k, this.right, (p) => (this.right = p), dt('second'))}`}
        </div>
        <div class="acts"><sw-button variant="primary" icon="layers" data-diag-run ?disabled=${!ready || this.load === 'loading'} @click=${() => void this.compare()}>${dt('compare')}</sw-button>
          ${k === 'doors' ? html`<span class="muted">${dt('doorsCompareHint')}</span>` : nothing}</div>
      </section>
      ${this.status()}
      ${this.load === 'ready' && this.comparison ? this.renderComparison(this.comparison) : nothing}
      ${this.load === 'ready' && this.doorComparison ? this.renderDoorComparison(this.doorComparison) : nothing}`;
  }

  private summary(sum: Record<string, number>, left: string, right: string): TemplateResult {
    return html`<div class="kpis" data-diag-summary>
      <div class="kpi"><b>${sum.shared ?? 0}</b><span>${dt('sumShared')}</span></div>
      <div class="kpi"><b>${sum.left_only ?? 0}</b><span>${relationText('left_only', left, right)}</span></div>
      <div class="kpi"><b>${sum.right_only ?? 0}</b><span>${relationText('right_only', left, right)}</span></div>
      <div class="kpi"><b>${sum.neither ?? 0}</b><span>${dt('rel_neither')}</span></div>
    </div>`;
  }

  private renderComparison(c: Comparison): TemplateResult {
    const [l, r] = [c.left.name || c.left.id || dt('first'), c.right.name || c.right.id || dt('second')];
    const groups = rowsByStation(c.rows);
    return html`<section class="card" data-diag-comparison>
      ${this.summary(c.summary, l, r)}
      ${groups.length
        ? groups.map((g) => html`<h3>${g.station_name}</h3><ul class="rows">${g.rows.map((row) => html`<li data-diag-row=${`${row.station_id}:${row.lock_id}`}>
            <span class="name">${doorLabel(this.home?.doors, row.station_id, row.lock_id)}</span>
            <sw-badge kind=${relationTone(row.relation) === 'ok' ? 'live' : relationTone(row.relation) === 'warn' ? 'partial' : 'neutral'} label=${relationText(row.relation, l, r)}
              data-diag-relation=${row.relation}></sw-badge>
            <div class="side"><span><b>${l}:</b> ${row.left.granted ? dt('granted') : dt('notGranted')} · ${sourceText(row.left)}</span>
              <span><b>${r}:</b> ${row.right.granted ? dt('granted') : dt('notGranted')} · ${sourceText(row.right)}</span></div>
          </li>`)}</ul>`)
        : html`<p class="note">${dt('noRows')}</p>`}
      <div class="acts">${this.fetched()}</div>
    </section>`;
  }

  private renderDoorComparison(c: DoorComparison): TemplateResult {
    const l = doorLabel(this.home?.doors, parseDoorKey(this.leftDoor)?.station_id ?? null, parseDoorKey(this.leftDoor)?.lock_id ?? 1);
    const r = doorLabel(this.home?.doors, parseDoorKey(this.rightDoor)?.station_id ?? null, parseDoorKey(this.rightDoor)?.lock_id ?? 1);
    return html`<section class="card" data-diag-door-comparison>
      ${this.summary(c.summary, l, r)}
      ${c.complete ? nothing : html`<p class="note">${dt('incomplete')}</p>`}
      ${c.rows.length
        ? html`<ul class="rows">${c.rows.map((row) => html`<li data-diag-person=${row.user_id}>
            <span class="name">${row.display_name || row.user_id}${row.archived ? html` <span class="muted">· ${dt('person_archived')}</span>` : nothing}</span>
            <sw-badge kind=${relationTone(row.relation) === 'ok' ? 'live' : relationTone(row.relation) === 'warn' ? 'partial' : 'neutral'} label=${relationText(row.relation, l, r)}
              data-diag-relation=${row.relation}></sw-badge>
            <div class="side"><span><b>${l}:</b> ${row.left_assigned ? (row.left ? dt('granted') : dt('notGranted')) : dt('noAssignment')}</span>
              <span><b>${r}:</b> ${row.right_assigned ? (row.right ? dt('granted') : dt('notGranted')) : dt('noAssignment')}</span></div>
          </li>`)}</ul>`
        : html`<p class="note">${dt('noPeopleRows')}</p>`}
      <div class="acts">${this.fetched()}</div>
    </section>`;
  }

  // ---------------------------------------------------------------- reviews

  private async loadReviews(offset: number): Promise<void> {
    const door = parseDoorKey(this.reviewDoor);
    if (!door) return;
    const snapshot = offset ? this.reviews?.snapshot ?? '' : '';
    await this.run(() => getReviews(door.station_id, door.lock_id, this.reviewState, offset, snapshot), (r) => {
      this.reviews = r.reviews;
      this.reviewOffset = offset;
      return !!r.reviews;
    });
  }

  private renderReviews(): TemplateResult {
    const page = this.load === 'ready' ? this.reviews : null;
    return html`<section class="card" data-diag-reviews>
        <div class="form">${this.renderDoorSelect(dt('reviewDoor'), this.reviewDoor, (v) => { this.reviewDoor = v; void this.loadReviews(0); }, 'reviews')}</div>
        <div class="seg" role="group" aria-label=${dt('v_reviews')}>
          ${REVIEW_STATES.map((s) => html`<button type="button" aria-pressed=${String(this.reviewState === s)} data-diag-state-filter=${s}
            @click=${() => { this.reviewState = s; void this.loadReviews(0); }}>${dtDyn(`st_${s}`, 'st_unknown')}${page && s !== 'all' ? ` (${page.summary[s as keyof ReviewsPage['summary']] ?? 0})` : ''}</button>`)}
        </div>
      </section>
      ${this.status()}
      ${page ? this.renderReviewList(page) : nothing}`;
  }

  private renderReviewList(page: ReviewsPage): TemplateResult {
    if (page.stale) return html`<p class="note" data-diag-stale>${dt('stale')} <sw-button size="sm" @click=${() => void this.loadReviews(0)}>${dt('reload')}</sw-button></p>`;
    return html`<section class="card" data-diag-review-list>
      ${page.records.length
        ? html`<ul class="rows">${page.records.map((row) => html`<li data-diag-review=${row.user_id} data-diag-status=${row.status}>
            <span class="name">${row.display_name || row.user_id}</span>
            <sw-badge kind=${row.central.granted ? 'live' : 'offline'} label=${row.central.granted ? dt('granted') : dt('notGranted')}></sw-badge>
            <sw-badge kind=${({ ok: 'live', warn: 'partial', bad: 'error', neutral: 'neutral' } as const)[reviewTone(row.status)]} label=${dtDyn(`st_${row.status}`, 'st_unknown')}></sw-badge>
            <sw-button size="sm" variant="secondary" data-diag-open-review @click=${() => void this.openReviewOf(row)}>${dt('review')}</sw-button>
            ${row.latest
              ? html`<span class="detail">${dt('lastDecision', { d: dtDyn(`d_${row.latest.decision}`, 'd_unknown'), t: dayText(row.latest.at, this.zone) })}${row.latest.arx_actor ? ` · ${dt('decidedBy', { who: row.latest.arx_actor })}` : ''}${row.latest.due_at ? ` · ${dt('nextReview', { t: dayText(row.latest.due_at, this.zone) })}` : ''}</span>`
              : nothing}
          </li>`)}</ul>`
        : html`<p class="note">${dt('noReviews')}</p>`}
      ${this.pager(page, (o) => void this.loadReviews(o))}
    </section>`;
  }

  private pager(page: { total: number | null; offset: number | null; limit: number | null; next_offset: number | null; previous_offset: number | null; records: unknown[] }, go: (o: number) => void): TemplateResult {
    const from = (page.offset ?? 0) + 1;
    const to = (page.offset ?? 0) + page.records.length;
    return html`<div class="pager">
      <span class="muted">${page.total ? dt('pageOf', { from, to, total: page.total }) : ''} ${this.fetched()}</span>
      ${page.previous_offset !== null || page.next_offset !== null
        ? html`<div class="acts"><sw-button size="sm" ?disabled=${page.previous_offset === null} @click=${() => go(page.previous_offset ?? 0)}>${dt('prev')}</sw-button>
            <sw-button size="sm" ?disabled=${page.next_offset === null} data-diag-next @click=${() => go(page.next_offset ?? 0)}>${dt('next')}</sw-button></div>`
        : nothing}
    </div>`;
  }

  private async openReviewOf(row: ReviewRow): Promise<void> {
    const door = parseDoorKey(this.reviewDoor);
    if (!door) return;
    this.openReview = row;
    this.preview = null;
    this.previewError = '';
    this.decision = 'keep';
    this.reason = '';
    this.cadence = 90;
    this.confirming = false;
    this.decideLine = null;
    try {
      const p = await getReviewPreview(row.user_id, door.station_id, door.lock_id);
      if (this.openReview !== row) return;
      this.preview = p;
      if (!p.preview) this.previewError = dt('unavailable');
    } catch (err) {
      if (this.openReview === row) this.previewError = describeError(err);
    }
  }

  private closeReview(): void {
    if (this.saving) return;
    const saved = this.decideLine?.ok;
    this.openReview = null;
    this.preview = null;
    if (saved) void this.loadReviews(this.reviewOffset);
  }

  private async submitDecision(): Promise<void> {
    const p = this.preview?.preview;
    const door = parseDoorKey(this.reviewDoor);
    const reason = cleanReason(this.reason);
    if (!p || !door || !reason || p.person_revision === null || !p.user_id) return;
    this.saving = true;
    this.decideLine = null;
    try {
      const r = await postDecide({ user_id: p.user_id, station_id: door.station_id, lock_id: door.lock_id, person_revision: p.person_revision, fingerprint: p.fingerprint,
        latest_id: p.latest_id, decision: this.decision, reason, cadence_days: this.cadence });
      this.decideLine = { ok: true, text: `${dt('saved')} · ${dt('nextReview', { t: dayText(r.receipt.due_at, this.zone) })}` };
    } catch (err) {
      this.decideLine = { ok: false, text: describeError(err) };
    } finally {
      this.saving = false;
      this.confirming = false;
    }
  }

  private renderReviewDialog(): TemplateResult | typeof nothing {
    const row = this.openReview;
    if (!row) return nothing;
    const p = this.preview?.preview ?? null;
    const decide = this.preview?.decide;
    const canDecide = !!(decide && decide.available === true && decide.allowed && this.home?.can.decide);
    const door = doorLabel(this.home?.doors, parseDoorKey(this.reviewDoor)?.station_id ?? null, parseDoorKey(this.reviewDoor)?.lock_id ?? 1);
    const reason = cleanReason(this.reason);
    return html`<sw-dialog open wide heading=${dt('reviewTitle')} subheading=${`${row.display_name} · ${door}`} ?locked=${this.saving} @close=${() => this.closeReview()} data-diag-review-dialog>
      ${this.previewError ? html`<p class="note bad" role="alert">${this.previewError}</p>` : nothing}
      ${!p && !this.previewError ? html`<sw-state-panel compact state="loading" heading=${dt('loading')}></sw-state-panel>` : nothing}
      ${p
        ? html`<dl class="lines">
            <dt>${dt('door')}</dt><dd>${p.central.granted ? dt('granted') : dt('notGranted')}</dd>
            <dt>${dt('validity')}</dt><dd>${p.central.archived ? `${dt('person_archived')} · ` : !p.central.active ? `${dt('person_inactive')} · ` : ''}${validityText(p.central.valid_from, p.central.valid_until, this.zone)}</dd>
            <dt>${dt('schedule')}</dt><dd>${dtDyn(`t_${p.central.timing_mode}`, 't_unknown')}${p.central.schedule?.periods.length ? ` · ${p.central.schedule.periods.map((x) => `${x.start}–${x.end}`).join(', ')}` : ''}</dd>
          </dl>
          <h3>${dt('history')}</h3>
          ${p.history.length
            ? html`<ul class="rows">${p.history.map((h) => html`<li><span class="name">${dtDyn(`d_${h.decision}`, 'd_unknown')} · ${dayText(h.at, this.zone)}</span>
                <span class="detail">${h.reason}${h.arx_actor ? ` · ${dt('decidedBy', { who: h.arx_actor })}` : ''}</span></li>`)}</ul>`
            : html`<p class="muted">${dt('noHistory')}</p>`}
          <p class="note">${dt('reviewHint')}</p>
          ${this.decideLine ? html`<p class="note ${this.decideLine.ok ? 'ok' : 'bad'}" role="status" data-diag-decide-line>${this.decideLine.text}</p>` : nothing}
          ${canDecide && !this.decideLine?.ok ? this.renderDecideForm(row.display_name, door, reason) : nothing}
          ${!canDecide
            ? html`<p class="note" data-diag-view-only>${decide && decide.available === true && !decide.allowed ? dt('decideNoPermission') : dt('decideViewOnly')}</p>
                <a class="link" href=${deepLinkHref('access.reviews')} data-diag-panel>${dt('openPanel')}</a>`
            : nothing}`
        : nothing}
      <sw-button slot="footer" ?disabled=${this.saving} @click=${() => this.closeReview()}>${dt('close')}</sw-button>
    </sw-dialog>`;
  }

  private renderDecideForm(person: string, door: string, reason: string | null): TemplateResult {
    if (this.confirming) {
      return html`<div class="card" role="group" data-diag-confirm>
        <b>${dt('confirmTitle')}</b>
        <span>${dt('confirmBody', { decision: dtDyn(`d_${this.decision}`, 'd_unknown'), person, door, n: this.cadence })}</span>
        <div class="acts end"><sw-button ?disabled=${this.saving} @click=${() => (this.confirming = false)}>${dt('cancel')}</sw-button>
          <sw-button variant="primary" ?disabled=${this.saving} data-diag-confirm-yes @click=${() => void this.submitDecision()}>${this.saving ? dt('saving') : dt('confirm')}</sw-button></div>
      </div>`;
    }
    return html`<div class="form" data-diag-decide>
      <div class="f"><span class="muted">${dt('decision')}</span>
        <div class="seg" role="group" aria-label=${dt('decision')}>
          ${(['keep', 'followup'] as const).map((d) => html`<button type="button" aria-pressed=${String(this.decision === d)} data-diag-decision=${d} @click=${() => (this.decision = d)}>${dt(d === 'keep' ? 'd_keep' : 'd_followup')}</button>`)}
        </div></div>
      <label class="f">${dt('cadence')}
        <select data-diag-cadence .value=${String(this.cadence)} @change=${(e: Event) => (this.cadence = Number((e.target as HTMLSelectElement).value))}>
          ${CADENCES.map((n) => html`<option value=${String(n)} ?selected=${n === this.cadence}>${dt('days', { n })}</option>`)}
        </select></label>
      <label class="f" style="grid-column: 1 / -1">${dt('reason')}
        <textarea maxlength="500" data-diag-reason placeholder=${dt('reasonPh')} .value=${this.reason} @input=${(e: Event) => (this.reason = (e.target as HTMLTextAreaElement).value)}></textarea></label>
      <div class="acts" style="grid-column: 1 / -1"><sw-button variant="primary" icon="check" data-diag-decide-go ?disabled=${!reason} @click=${() => (this.confirming = true)}>${dt('confirm')}</sw-button></div>
    </div>`;
  }

  // ---------------------------------------------------------------- quality

  private async loadQuality(offset: number): Promise<void> {
    const snapshot = offset ? this.quality?.snapshot ?? '' : '';
    await this.run(() => getQuality(this.qKind, this.qState, offset, snapshot), (r) => {
      this.quality = r.quality;
      return !!r.quality;
    });
  }

  private renderQuality(): TemplateResult {
    const page = this.load === 'ready' ? this.quality : null;
    return html`<section class="card" data-diag-quality-filters>
        <div class="seg" role="group" aria-label=${dt('v_quality')}>
          ${(['all', 'missing', 'invalid', 'duplicate'] as const).map((k) => html`<button type="button" aria-pressed=${String(this.qKind === k)} data-diag-qkind=${k}
            @click=${() => { this.qKind = k; void this.loadQuality(0); }}>${dt(k === 'all' ? 'q_all' : k === 'missing' ? 'q_missing' : k === 'invalid' ? 'q_invalid' : 'q_duplicate')}</button>`)}
        </div>
        <div class="seg" role="group" aria-label=${dt('v_quality')}>
          ${(['current', 'archived', 'all'] as const).map((k) => html`<button type="button" aria-pressed=${String(this.qState === k)} data-diag-qstate=${k}
            @click=${() => { this.qState = k; void this.loadQuality(0); }}>${dt(k === 'current' ? 'q_current' : k === 'archived' ? 'q_archived' : 'q_everyone')}</button>`)}
        </div>
      </section>
      ${this.status()}
      ${page
        ? page.stale
          ? html`<p class="note">${dt('stale')} <sw-button size="sm" @click=${() => void this.loadQuality(0)}>${dt('reload')}</sw-button></p>`
          : html`<section class="card" data-diag-quality>
              <div class="kpis">
                <div class="kpi"><b>${page.summary.people}</b><span>${dt('peopleIssues')}</span></div>
                <div class="kpi"><b>${page.summary.missing}</b><span>${dt('q_missing')}</span></div>
                <div class="kpi"><b>${page.summary.invalid}</b><span>${dt('q_invalid')}</span></div>
                <div class="kpi"><b>${page.summary.duplicate}</b><span>${dt('q_duplicate')}</span></div>
              </div>
              <span class="muted">${dt('scanned', { n: page.coverage.scanned })}</span>
              ${page.records.length
                ? html`<ul class="rows">${page.records.map((row) => html`<li data-diag-quality-row=${row.id}>
                    <span class="name">${row.display_name || row.id}${row.employee_no ? html` <span class="muted">· ${row.employee_no}</span>` : nothing}${row.archived ? html` <span class="muted">· ${dt('person_archived')}</span>` : nothing}</span>
                    <div class="detail chips">${row.issues.map((i) => html`<span class="chip" data-diag-issue=${i.code}>${issueText(i)}${i.related_people.length ? ` · ${dt('dupWith', { names: i.related_people.map((x) => x.display_name).join(', ') })}` : ''}</span>`)}</div>
                  </li>`)}</ul>`
                : html`<p class="note">${dt('noIssues')}</p>`}
              ${this.pager(page, (o) => void this.loadQuality(o))}
            </section>`
        : nothing}`;
  }

  // ---------------------------------------------------------------- lifecycle

  private async loadLifecycle(): Promise<void> {
    await this.run(() => getLifecycle(this.days), (r) => {
      this.lifecycle = r.lifecycle;
      return !!r.lifecycle;
    });
  }

  private lifeRow(row: LifeRow, extra: string): TemplateResult {
    return html`<li data-diag-life=${row.id}>
      <span class="name">${row.display_name || row.id}${row.employee_no ? html` <span class="muted">· ${row.employee_no}</span>` : nothing}</span>
      ${row.access_category !== 'unknown' ? html`<span class="chip">${dtDyn(`cat_${row.access_category}`, 'cat_unknown')}</span>` : nothing}
      <span class="muted">${extra}</span>
      <span class="detail">${validityText(row.valid_from, row.valid_until, this.zone)} · ${dt('doorsCount', { n: row.assignment_count })}</span>
    </li>`;
  }

  private renderLifecycle(): TemplateResult {
    const life = this.load === 'ready' ? this.lifecycle : null;
    return html`<section class="card" data-diag-life-filters>
        <div class="acts"><span class="muted">${dt('window')}</span>
          <div class="seg" role="group" aria-label=${dt('window')}>
            ${WINDOWS.map((n) => html`<button type="button" aria-pressed=${String(this.days === n)} data-diag-days=${n} @click=${() => { this.days = n; void this.loadLifecycle(); }}>${dt('days', { n })}</button>`)}
          </div></div>
        <span class="muted">${dt('lifeHint')}</span>
      </section>
      ${this.status()}
      ${life
        ? html`<section class="card" data-diag-lifecycle>
            <div class="kpis">
              <div class="kpi"><b>${life.summary.expiring}</b><span>${dt('expiring')}</span></div>
              <div class="kpi"><b>${life.summary.expired}</b><span>${dt('expired')}</span></div>
              <div class="kpi"><b>${life.temporary.summary.total ?? 0}</b><span>${dt('temporary')}</span></div>
              <div class="kpi"><b>${life.summary.without_credentials}</b><span>${dt('withoutCred')}</span></div>
            </div>
            <h3>${dt('expiring')}</h3>
            ${life.expirations.length
              ? html`<ul class="rows">${expiringFirst(life.expirations).map((r) => this.lifeRow(r, r.state === 'expired' ? `${dt('expired')} · ${remainingText(r.seconds_remaining)}` : remainingText(r.seconds_remaining)))}</ul>`
              : html`<p class="note">${dt('noneExpiring')}</p>`}
            ${life.truncated.expirations ? html`<p class="muted">${dt('truncated')}</p>` : nothing}
            ${life.temporary.users.length
              ? html`<h3>${dt('temporary')}</h3><ul class="rows">${life.temporary.users.map((r) => this.lifeRow(r, [dtDyn(`tmp_${r.state ?? 'unknown'}`, 'tmp_unknown'), r.expiring_soon ? remainingTextOf(r) : ''].filter(Boolean).join(' · ')))}</ul>`
              : nothing}
            ${life.duplicates.length
              ? html`<h3>${dt('duplicates')}</h3><ul class="rows">${life.duplicates.map((d) => html`<li><span class="name">${d.users.map((u) => u.display_name || u.id).join(' · ')}</span>
                  <span class="chip">${dtDyn(`dup_${d.reason}`, 'dup_unknown')}</span></li>`)}</ul>`
              : nothing}
            <h3>${dt('withoutCred')}</h3>
            ${life.without_credentials === null
              ? html`<p class="muted" data-diag-cred-hidden>${dt('credHidden')}</p>`
              : html`<ul class="rows">${life.without_credentials.map((r) => this.lifeRow(r, ''))}</ul>`}
            <div class="acts">${this.fetched()}</div>
          </section>`
        : nothing}`;
  }

  // ---------------------------------------------------------------- permission audit

  private async runAudit(): Promise<void> {
    const id = this.auditStation;
    if (!id) return;
    this.audit = null;
    await this.run(() => getPermissionAudit(id), (r) => {
      this.audit = r.audit;
      return !!r.audit;
    });
  }

  private renderAudit(): TemplateResult {
    const stations = this.home?.doors ?? [];
    const a = this.load === 'ready' ? this.audit : null;
    const chosen = stations.find((s) => s.id === this.auditStation);
    const order = { drift: 0, unmanaged: 1, unverified: 2, unknown: 3, matched: 4 } as const;
    return html`<section class="card" data-diag-audit-form>
        <span class="muted">${dt('auditHint')}</span>
        <div class="form">
          <label class="f">${dt('station')}
            <select data-diag-audit-station .value=${this.auditStation} @change=${(e: Event) => (this.auditStation = (e.target as HTMLSelectElement).value)}>
              ${stations.map((s) => html`<option value=${s.id} ?selected=${s.id === this.auditStation}>${s.name}${s.online ? '' : ` · ${dt('stationOffline')}`}</option>`)}
            </select></label>
        </div>
        ${chosen && !chosen.online ? html`<p class="note">${dt('stationOfflineNote')}</p>` : nothing}
        <div class="acts"><sw-button variant="primary" icon="shield" data-diag-run-audit ?disabled=${!chosen || !chosen.online || this.load === 'loading'} @click=${() => void this.runAudit()}>
          ${this.load === 'loading' ? dt('auditing') : dt('runAudit')}</sw-button><span class="muted">${dt('readOnly')}</span></div>
      </section>
      ${this.status()}
      ${a
        ? html`<section class="card" data-diag-audit>
            <span class="muted">${dt('auditFor', { station: chosen?.name ?? a.station_id ?? '', t: instantText(a.checked_at, this.zone) })}</span>
            <div class="kpis">${(['matched', 'drift', 'unmanaged', 'unverified'] as const).map((k) => html`<div class="kpi"><b>${a.counts[k]}</b><span>${dtDyn(`a_${k}`, 'a_unknown')}</span></div>`)}</div>
            ${a.complete ? nothing : html`<p class="note">${dt('auditIncomplete')}</p>`}
            <ul class="rows">${[...a.rows].sort((x, y) => order[x.status] - order[y.status]).map((row) => html`<li data-diag-audit-row=${row.status}>
              <span class="name">${row.display_name || (row.status === 'unmanaged' ? dt('unmanagedUser') : '—')}${row.employee_no ? html` <span class="muted">· ${row.employee_no}</span>` : nothing}</span>
              <sw-badge kind=${row.status === 'matched' ? 'live' : row.status === 'drift' ? 'partial' : row.status === 'unmanaged' ? 'error' : 'unknown'} label=${dtDyn(`a_${row.status}`, 'a_unknown')}></sw-badge>
              ${row.differences.length ? html`<div class="detail chips">${row.differences.map((d) => html`<span class="chip">${diffText(d)}</span>`)}</div>` : nothing}
            </li>`)}</ul>
          </section>`
        : !this.audit && this.load === 'idle'
          ? html`<p class="muted">${dt('noAuditYet')}</p>`
          : nothing}`;
  }

  // ---------------------------------------------------------------- sync

  private async loadSync(): Promise<void> {
    await this.run(() => getSyncDiag(), (r) => {
      this.sync = r.diagnostics;
      return !!r.diagnostics;
    });
  }

  private renderSync(): TemplateResult {
    const s = this.load === 'ready' ? this.sync : null;
    const failures = s ? Object.entries(s.failures) : [];
    return html`<section class="card"><span class="muted">${dt('syncHint')}</span>
        <div class="acts"><sw-button size="sm" icon="refresh" data-diag-sync-refresh ?disabled=${this.load === 'loading'} @click=${() => void this.loadSync()}>${dt('reload')}</sw-button>
          ${s?.integration_version ? html`<span class="muted">${dt('version', { v: s.integration_version })}</span>` : nothing}</div></section>
      ${this.status()}
      ${s
        ? html`<section class="card" data-diag-sync>
            ${s.stations.length
              ? html`<ul class="rows">${s.stations.map((st) => html`<li data-diag-sync-station=${st.station_ref}>
                  <span class="name">${dt('stationRef', { ref: st.station_ref.slice(0, 6) })}</span>
                  <sw-badge kind=${st.state === 'synced' ? 'live' : st.state === 'error' || st.state === 'conflict' ? 'error' : st.state === 'offline' ? 'offline' : 'partial'} label=${dtDyn(`sync_${st.state}`, 'sync_unknown')}></sw-badge>
                  ${st.last_error ? html`<span class="chip">${st.last_error}</span>` : nothing}
                  <span class="detail">${[st.worker_active ? dt('worker') : '', st.pending_request ? dt('pendingReq') : '', st.reconciliation_targets ? dt('targets', { n: st.reconciliation_targets }) : ''].filter(Boolean).join(' · ')}</span>
                </li>`)}</ul>`
              : html`<p class="note">${dt('noStations')}</p>`}
            <h3>${dt('recentFailures')}</h3>
            ${failures.length
              ? html`<div class="chips">${failures.map(([code, n]) => html`<span class="chip" data-diag-failure=${code}>${code} · ${n}</span>`)}</div>`
              : html`<p class="muted">${dt('noFailures')}</p>`}
            <h3>${dt('recent')}</h3>
            <ul class="rows">${s.recent.slice(0, 12).map((r) => html`<li><span class="name">${dt('stationRef', { ref: r.station_ref.slice(0, 6) })} · ${r.step}</span>
              <sw-badge kind=${r.outcome === 'failed' ? 'error' : r.outcome === 'succeeded' ? 'live' : 'neutral'} label=${r.outcome}></sw-badge>
              <span class="muted">${instantText(r.at, this.zone)}${r.error ? ` · ${r.error}` : ''}</span></li>`)}</ul>
            <div class="acts">${this.fetched()}</div>
          </section>`
        : nothing}`;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-access-diag': WiskeyAccessDiag;
  }
}

