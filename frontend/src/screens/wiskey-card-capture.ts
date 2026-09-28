import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-field';
import '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import {
  actionOutcome,
  cancelIntercomCardCapture,
  confirmIntercomCardCapture,
  getIntercomCardCapture,
  getIntercomCardReaders,
  startIntercomCardCapture,
  type IntercomCapture,
  type IntercomEditorContext,
  type IntercomEditorPerson,
} from '../api/intercom';
import { t } from './wiskey-format';

type Step = 'choose' | 'confirm' | 'session' | 'confirm_save' | 'start_unknown';
type Busy = '' | 'readers' | 'start' | 'cancel' | 'save';

/** WisKey's collection window (enrollment._collect, 70 s) and session TTL (SESSION_SECONDS, 120 s), for the countdown
 * shown before the first status arrives; afterwards the server's own remaining times are used. */
const COLLECT_S = 70;
const POLL_ACTIVE_MS = 1000; // WisKey's panel: every 1000 ms while preparing / waiting
const POLL_CAPTURED_MS = 3000; // a collected card waiting for approval: only its TTL runs (and the backend wants to know the dialog is still open)
const POLL_RETRY_MS = 2000;
const ACTIVE = new Set(['preparing', 'waiting', 'captured', 'applying']);
const CANCELLABLE = new Set(['preparing', 'waiting', 'captured']);

/** A WisKey error code in WisKey's own words when its i18n has them, else the backend's message. */
function wiskeyText(err: unknown): string {
  const code = err instanceof ApiError ? (err.body?.details?.wiskey_code as string | undefined) : undefined;
  const own = code ? t(code) : '';
  return code && own !== code.replaceAll('_', ' ') ? own : describeError(err);
}

/**
 * WisKey tab: reading a card from a station's reader into the person editor (CR-005 phase 2, slice A2,
 * `access.cards.capture` + `access.people.manage`). Ported from the owner's WisKey panel - `openCapture()`,
 * `readCaptureCapabilities()`, `startCapture()`, `pollCapture()`, `confirmCapture()`, `clearCapture()` and the dialog's
 * `captureBody()` / `captureFooter()` (panel.ts:1432-1630) with WisKey's Hebrew copy - over the SMPLWISE backend, which
 * owns the session for this SMPLWISE user, follows it on WisKey and serves this dialog its own copy.
 *
 * Deliberate differences, as CR-005 asks for physical actions: an explicit confirmation step before the reader is put
 * into collection mode (WisKey starts at once), a live countdown of WisKey's own limits, and honest end states WisKey's
 * panel has no text for - cancelled, expired, a start or a cancel whose outcome is unknown (the reader may still be
 * collecting until WisKey's timeout). As in WisKey, the collected card is shown masked only (the number never leaves
 * WisKey) and nothing is added to the person until the administrator approves it; the approval itself is WisKey's
 * `cards/capture_confirm`, which stores the card and asks for the stations' sync.
 */
@customElement('wiskey-card-capture')
export class WiskeyCardCapture extends LitElement {
  @property({ attribute: false }) person!: IntercomEditorPerson;
  @property({ attribute: false }) stations: IntercomEditorContext['stations'] = [];

  @state() private step: Step = 'choose';
  @state() private station = '';
  @state() private readers: number[] | null = null;
  @state() private reader = 0;
  @state() private busy: Busy = '';
  @state() private capture: IntercomCapture | null = null;
  @state() private label = '';
  @state() private error = '';
  @state() private errorCode = '';
  @state() private outcome: '' | 'not_sent' | 'refused' | 'unknown' = '';
  @state() private holdUntil = 0; // after a start with an unknown outcome: until when the reader may be collecting (ms, performance clock)
  @state() private now = performance.now();
  private receivedAt = performance.now();
  private epoch = 0;
  private pollTimer = 0;
  private tickTimer = 0;

  connectedCallback() {
    super.connectedCallback();
    const first = this.usable()[0]?.id ?? '';
    this.station = first;
    if (first) void this.readReaders(first);
    this.tickTimer = window.setInterval(() => (this.now = performance.now()), 250);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.tickTimer);
    this.clear(); // WisKey clearCapture(): leaving the dialog stops HA-side collection
  }

  /** WisKey offers the stations that are online and have a managed lock (`lock_enabled && online`). */
  private usable() {
    return this.stations.filter((s) => s.lock_enabled && s.online);
  }

  /** WisKey `clearCapture()`: forget the session and cancel it on WisKey when it is still running (fire and forget). */
  private clear() {
    this.epoch++;
    window.clearTimeout(this.pollTimer);
    const c = this.capture;
    this.capture = null;
    if (c && CANCELLABLE.has(c.state)) void cancelIntercomCardCapture(c.session_id).catch(() => {});
  }

  private setError(text: string, code = '', outcome: '' | 'not_sent' | 'refused' | 'unknown' = '') {
    this.error = text;
    this.errorCode = code;
    this.outcome = outcome;
  }

  // ------------------------------------------------------------------ WisKey readCaptureCapabilities()

  private async readReaders(station: string) {
    this.clear();
    this.step = 'choose';
    this.station = station;
    this.readers = null;
    this.reader = 0;
    this.setError('');
    if (!station) return;
    const epoch = this.epoch;
    this.busy = 'readers';
    try {
      const r = await getIntercomCardReaders(station);
      if (epoch !== this.epoch) return;
      if (r.readers) {
        this.readers = r.readers.readers;
        this.reader = r.readers.readers[0] ?? 0;
      } else {
        const code = r.last_error ?? r.state;
        this.setError(t(code) !== code.replaceAll('_', ' ') ? t(code) : `לא ניתן לקרוא את יכולות הקורא (${code}).`, code);
      }
    } catch (err) {
      if (epoch === this.epoch) this.setError(describeError(err), err instanceof ApiError ? err.code : 'error');
    } finally {
      if (epoch === this.epoch) this.busy = '';
    }
  }

  // ------------------------------------------------------------------ WisKey startCapture() - behind a confirmation step

  private async start() {
    if (this.busy || !this.station || !this.readers?.length) return;
    const epoch = ++this.epoch;
    this.busy = 'start';
    this.setError('');
    try {
      const r = await startIntercomCardCapture(this.person.id, this.station, this.reader, this.person.revision ?? 0);
      if (epoch !== this.epoch) {
        if (r.capture) void cancelIntercomCardCapture(r.capture.session_id).catch(() => {}); // the dialog was left meanwhile (WisKey does the same)
        return;
      }
      this.show(r.capture);
      this.step = 'session';
    } catch (err) {
      if (epoch !== this.epoch) return;
      const outcome = actionOutcome(err);
      if (outcome === 'unknown') {
        const wait = err instanceof ApiError ? Number(err.body?.details?.retry_after_s) : NaN;
        this.holdUntil = performance.now() + (Number.isFinite(wait) && wait > 0 ? wait : 120) * 1000;
        this.step = 'start_unknown';
        this.setError(describeError(err), err instanceof ApiError ? err.code : 'error', 'unknown');
      } else {
        this.step = 'choose';
        this.setError(wiskeyText(err), err instanceof ApiError ? err.code : 'error', outcome);
      }
    } finally {
      if (epoch === this.epoch) this.busy = '';
    }
  }

  private show(capture: IntercomCapture | null) {
    this.capture = capture;
    this.receivedAt = performance.now();
    window.clearTimeout(this.pollTimer);
    if (capture && ACTIVE.has(capture.state) && capture.state !== 'applying') {
      const epoch = this.epoch;
      this.pollTimer = window.setTimeout(() => void this.poll(epoch), capture.state === 'captured' ? POLL_CAPTURED_MS : POLL_ACTIVE_MS);
    }
  }

  // ------------------------------------------------------------------ WisKey pollCapture() (the SMPLWISE backend's copy)

  private async poll(epoch: number) {
    const id = this.capture?.session_id;
    if (!id || epoch !== this.epoch) return;
    try {
      const r = await getIntercomCardCapture(id);
      if (epoch !== this.epoch || this.busy === 'save' || this.busy === 'cancel') return;
      this.show(r.capture);
    } catch (err) {
      if (epoch !== this.epoch) return;
      if (err instanceof ApiError && err.code === 'intercom_capture_not_found') {
        this.capture = this.capture ? { ...this.capture, state: 'lost', active: false, card: null } : null;
        this.setError(t('capture_not_found'), err.code);
        return;
      }
      this.pollTimer = window.setTimeout(() => void this.poll(epoch), POLL_RETRY_MS); // a network blip: the session runs on
    }
  }

  // ------------------------------------------------------------------ cancel / again / close

  private async cancel() {
    const c = this.capture;
    if (!c || !CANCELLABLE.has(c.state) || this.busy) return;
    this.busy = 'cancel';
    window.clearTimeout(this.pollTimer);
    const epoch = this.epoch;
    try {
      const r = await cancelIntercomCardCapture(c.session_id);
      if (epoch !== this.epoch) return;
      this.setError('');
      this.show(r.capture);
    } catch (err) {
      if (epoch !== this.epoch) return;
      const view = err instanceof ApiError ? (err.body?.details?.capture as IntercomCapture | undefined) : undefined;
      const outcome = actionOutcome(err);
      this.setError(outcome === 'unknown' ? `לא ידוע אם הביטול התקבל ב־WisKey: ${describeError(err)}` : wiskeyText(err), err instanceof ApiError ? err.code : 'error', outcome);
      this.show(view ?? c);
    } finally {
      if (epoch === this.epoch) this.busy = '';
    }
  }

  /** WisKey "Collect another card": cancel what runs, read the capabilities again. */
  private again() {
    void this.readReaders(this.station);
  }

  private close() {
    if (this.busy === 'save') {
      this.requestUpdate(); // the approval is in flight and its answer must be seen: the dialog opens again
      return;
    }
    this.clear();
    this.dispatchEvent(new CustomEvent('capture-close', { bubbles: true, composed: true }));
  }

  // ------------------------------------------------------------------ WisKey confirmCapture()

  private async save() {
    const c = this.capture;
    if (!c || c.state !== 'captured' || this.busy) return;
    this.busy = 'save';
    window.clearTimeout(this.pollTimer);
    const epoch = this.epoch;
    try {
      const r = await confirmIntercomCardCapture(c.session_id, this.label);
      this.capture = r.capture;
      this.dispatchEvent(new CustomEvent('capture-saved', { detail: { person: r.person, note: r.note }, bubbles: true, composed: true }));
    } catch (err) {
      if (epoch !== this.epoch) return;
      const view = err instanceof ApiError ? (err.body?.details?.capture as IntercomCapture | undefined) : undefined;
      const outcome = actionOutcome(err);
      this.step = 'session';
      if (outcome === 'unknown') {
        this.setError(`${t('capture_state_unconfirmed')} (${describeError(err)})`, err instanceof ApiError ? err.code : 'error', 'unknown');
        this.show(view ?? { ...c, state: 'unconfirmed', active: false, card: null });
      } else {
        this.setError(wiskeyText(err), err instanceof ApiError ? err.code : 'error', outcome);
        this.show(view ?? c);
      }
    } finally {
      this.busy = '';
    }
  }

  // ------------------------------------------------------------------ render

  private remaining(value: number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    return Math.max(0, Math.ceil(value - (this.now - this.receivedAt) / 1000));
  }

  private stationName(id: string) {
    return this.stations.find((s) => s.id === id)?.name ?? id;
  }

  render() {
    const c = this.capture;
    const state = this.step === 'session' || this.step === 'confirm_save' ? (c?.state ?? 'preparing') : this.step;
    return html`<sw-dialog
      .open=${live(true)}
      heading=${t('capture_card')}
      subheading=${`${this.person.display_name} · ${this.person.employee_no}`}
      data-wiskey-capture
      data-wiskey-capture-step=${this.step}
      data-wiskey-capture-state=${state}
      @close=${() => this.close()}
    >
      ${this.step === 'choose' ? this.renderChoose() : nothing}
      ${this.step === 'confirm' ? this.renderConfirm() : nothing}
      ${this.step === 'start_unknown' ? this.renderStartUnknown() : nothing}
      ${(this.step === 'session' || this.step === 'confirm_save') && c ? this.renderSession(c) : nothing}
      ${this.error && this.step !== 'start_unknown' ? html`<p class="note ${this.outcome === 'unknown' ? 'warn' : 'err'}" role="alert" data-wiskey-capture-error=${this.errorCode} data-wiskey-capture-outcome=${this.outcome}>${this.error}</p>` : nothing}
      <p class="muted">${t('capture_limits')}</p>
      <div slot="footer" class="footer">${this.renderFooter()}</div>
    </sw-dialog>`;
  }

  private renderChoose() {
    const usable = this.usable();
    return html`<p class="muted">${t('capture_hint')}</p>
      <div class="grid2">
        <sw-field label=${t('station')}>
          <select data-wiskey-capture-station .value=${live(this.station)} ?disabled=${this.busy === 'start'} @change=${(e: Event) => void this.readReaders((e.target as HTMLSelectElement).value)}>
            <option value="" disabled>${t('select_station')}</option>
            ${usable.map((s) => html`<option value=${s.id} ?selected=${s.id === this.station}>${s.name}</option>`)}
          </select>
        </sw-field>
        <sw-field label=${t('capture_reader')}>
          <select aria-label=${t('capture_reader')} data-wiskey-capture-reader .value=${live(String(this.reader))} ?disabled=${!this.readers?.length} @change=${(e: Event) => (this.reader = Number((e.target as HTMLSelectElement).value))}>
            ${(this.readers ?? []).map((id) => html`<option value=${id} ?selected=${id === this.reader}>${id === 0 ? t('capture_default_reader') : id}</option>`)}
          </select>
        </sw-field>
      </div>
      ${usable.length ? nothing : html`<p class="note err" data-wiskey-capture-no-station>אין כרגע אינטרקום מחובר עם מנעול מנוהל שאפשר לקרוא בו כרטיס.</p>`}
      <p role="status" data-wiskey-capture-status>${this.busy === 'readers' ? t('loading') : t('capture_state_choose')}</p>`;
  }

  private renderConfirm() {
    const name = this.stationName(this.station);
    return html`<div class="confirm" data-wiskey-capture-confirm-step>
      <p><b>להפעיל את קורא הכרטיסים בעמדה ${name}?</b></p>
      <p>הקורא בעמדה ייכנס עכשיו למצב קריאת כרטיס, לעד ${COLLECT_S} שניות. בקשו מ־<b>${this.person.display_name}</b> (או ממי שמחזיק את הכרטיס) לעמוד ליד העמדה ולהצמיד <b>כרטיס אחד</b> לקורא כשתופיע כאן ההנחיה "הצמד כעת כרטיס".</p>
      <p>המספר שנקרא יוצג כאן ממוסך, ורק אחרי אישורכם הוא יתווסף למשתמש ויסונכרן לתחנות שלו. ${t('capture_hint').split('. ').slice(-1)[0]}</p>
      <p class="muted">הפעולה נרשמת ביומן הביקורת של SMPLWISE בשמך.</p>
    </div>`;
  }

  private renderStartUnknown() {
    const left = Math.max(0, Math.ceil((this.holdUntil - this.now) / 1000));
    return html`<div class="note warn" role="alert" data-wiskey-capture-error=${this.errorCode} data-wiskey-capture-outcome="unknown">
      <sw-icon name="warning" size=${16}></sw-icon>
      <span>לא ידוע אם הקורא נכנס למצב קריאה. ${this.error}</span>
    </div>
    <p data-wiskey-capture-countdown=${left}>${left > 0 ? `ייתכן שהקורא בעמדה ${this.stationName(this.station)} ממתין לכרטיס עוד עד ${left} שניות (עד שיפוג הזמן של WisKey). שום כרטיס לא יתווסף בלי אישורכם.` : 'זמן הקריאה של WisKey הסתיים. אפשר לנסות שוב.'}</p>`;
  }

  private renderSession(c: IntercomCapture) {
    const collecting = c.state === 'preparing' || c.state === 'waiting';
    const collectLeft = this.remaining(c.collect_remaining_s);
    const sessionLeft = this.remaining(c.session_remaining_s);
    const targets = this.person.stations.filter((s) => s.enabled).map((s) => this.stationName(s.station_id));
    return html`<div class="session">
      <p class="muted">${t('station')}: <b>${c.station_name ?? this.stationName(c.station_id)}</b> · ${t('capture_reader')}: ${c.reader_id === 0 ? t('capture_default_reader') : c.reader_id}</p>
      <p role="status" class="status ${collecting ? 'live' : ''}" data-wiskey-capture-status>
        ${collecting ? html`<span class="pulse" aria-hidden="true"></span>` : nothing}${this.stateText(c)}
      </p>
      ${collecting ? html`<p data-wiskey-capture-countdown=${collectLeft}>זמן שנותר לקריאה: <b>${collectLeft}</b> שניות</p>` : nothing}
      ${c.state === 'error' && c.error ? html`<p class="note err" data-wiskey-capture-wiskey-error=${c.error}>${t(c.error)}</p>` : nothing}
      ${c.card && (c.state === 'captured' || c.state === 'applying')
        ? html`<div class="card" data-wiskey-capture-card>
              <bdi data-ltr>${c.card.masked_number}</bdi>${c.card.technology ? html`<span> · <bdi>${c.card.technology}</bdi></span>` : nothing}
            </div>
            <sw-field label=${t('card_label')}>
              <input maxlength="64" data-wiskey-capture-label .value=${live(this.label)} ?disabled=${this.step === 'confirm_save' || this.busy === 'save'} @input=${(e: Event) => (this.label = (e.target as HTMLInputElement).value)} />
            </sw-field>
            <p class="muted">${t('capture_targets')}: ${targets.join(', ') || t('csv_no_stations')}</p>
            ${c.state === 'captured' ? html`<p class="muted" data-wiskey-capture-session-left=${sessionLeft}>הכרטיס ממתין לאישור עוד ${sessionLeft} שניות; אחר כך WisKey מוחק את הקריאה.</p>` : nothing}`
        : nothing}
      ${this.step === 'confirm_save' && c.state === 'captured'
        ? html`<div class="note info" data-wiskey-capture-save-prompt>${t('capture_confirm_prompt').replace('{name}', this.person.display_name)} הכרטיס יישמר ב־WisKey מיד ויפתח את הדלתות שהמשתמש משויך אליהן.</div>`
        : nothing}
      ${c.reader_may_be_collecting && !collecting
        ? html`<p class="note warn" data-wiskey-capture-maybe-collecting>ייתכן שהקורא בעמדה עדיין במצב קריאה עד שיפוג הזמן (עד ${sessionLeft} שניות לפי WisKey; זמן ההמתנה של הקורא עצמו נקבע בקושחה). שום כרטיס לא יתווסף בלי אישורכם.</p>`
        : nothing}
    </div>`;
  }

  private stateText(c: IntercomCapture): string {
    switch (c.state) {
      case 'cancel_unknown':
        return 'לא ידוע אם הביטול התקבל ב־WisKey.';
      case 'unconfirmed':
        return t('capture_state_unconfirmed');
      default:
        return t(`capture_state_${c.state}`);
    }
  }

  private renderFooter() {
    const c = this.capture;
    const busy = this.busy;
    const closeButton = html`<sw-button variant="ghost" data-wiskey-capture-close ?disabled=${busy === 'save'} @click=${() => this.close()}>${t('close')}</sw-button>`;
    if (this.step === 'choose') {
      return html`${closeButton}<sw-button variant="primary" data-wiskey-capture-next ?disabled=${!!busy || !this.station || !this.readers?.length} @click=${() => { this.setError(''); this.step = 'confirm'; }}>המשך</sw-button>`;
    }
    if (this.step === 'confirm') {
      return html`<sw-button variant="ghost" data-wiskey-capture-back ?disabled=${busy === 'start'} @click=${() => (this.step = 'choose')}>חזרה</sw-button>
        <sw-button variant="primary" icon="wifi" data-wiskey-capture-start ?disabled=${busy === 'start'} @click=${() => void this.start()}>${busy === 'start' ? t('wait') : t('capture_start')}</sw-button>`;
    }
    if (this.step === 'start_unknown') {
      return html`${closeButton}<sw-button data-wiskey-capture-again @click=${() => this.again()}>${t('capture_again')}</sw-button>`;
    }
    if (!c) return closeButton;
    if (this.step === 'confirm_save') {
      return html`<sw-button variant="ghost" data-wiskey-capture-save-back ?disabled=${busy === 'save'} @click=${() => (this.step = 'session')}>חזרה</sw-button>
        <sw-button variant="primary" icon="check" data-wiskey-capture-save-confirm ?disabled=${busy === 'save' || c.state !== 'captured'} @click=${() => void this.save()}>${busy === 'save' ? t('wait') : t('capture_save')}</sw-button>`;
    }
    const cancel = CANCELLABLE.has(c.state)
      ? html`<sw-button variant="danger" data-wiskey-capture-cancel ?disabled=${!!busy} @click=${() => void this.cancel()}>${busy === 'cancel' ? t('wait') : 'ביטול הקריאה'}</sw-button>`
      : nothing;
    const again = ['error', 'captured', 'cancelled', 'expired', 'lost', 'closed'].includes(c.state)
      ? html`<sw-button data-wiskey-capture-again ?disabled=${!!busy} @click=${() => this.again()}>${t('capture_again')}</sw-button>`
      : nothing;
    const save = c.state === 'captured' ? html`<sw-button variant="primary" icon="check" data-wiskey-capture-save ?disabled=${!!busy} @click=${() => { this.setError(''); this.step = 'confirm_save'; }}>${t('capture_save')}</sw-button>` : nothing;
    const reload = c.state === 'unconfirmed'
      ? html`<sw-button icon="refresh" data-wiskey-capture-reload @click=${() => { this.clear(); this.dispatchEvent(new CustomEvent('capture-reload', { bubbles: true, composed: true })); }}>טען מחדש את הרשומה</sw-button>`
      : nothing;
    return html`${closeButton}${cancel}${again}${reload}${save}`;
  }

  static styles = css`
    .grid2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 10px;
    }
    @media (max-width: 480px) {
      .grid2 {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    p {
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .session,
    .confirm {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: var(--sw-fw-semibold);
    }
    .pulse {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: var(--sw-accent, var(--sw-success));
      animation: pulse 1.2s ease-in-out infinite;
      flex: none;
    }
    @keyframes pulse {
      0%,
      100% {
        opacity: 0.3;
      }
      50% {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pulse {
        animation: none;
      }
    }
    .card {
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
      padding: 8px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    [data-ltr] {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .note {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    .note > span {
      flex: 1 1 200px;
    }
    .note.info {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .note.warn {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-card-capture': WiskeyCardCapture;
  }
}
