import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-dialog';
import '../components/update-run';
import '../components/restarts-card';
import { describeError } from '../api/client';
import { applyUpdate, classifyRunError, newIdempotencyKey, runFailureRequestText, type RunView } from '../api/system-update-runs';
import { productSettings } from '../api/prefs';
import {
  INTERVAL_CHOICES, checkForUpdate, classifyCheckError, getUpdateState, intervalLabel, resultLabel, setUpdateInterval,
  type CheckFailure, type UpdateState,
} from '../api/system-update';
import { notifyUpdateState } from '../shell/update-marker';

/**
 * הגדרות › עדכונים (CR-021 S2, installation scope, `system.update`: system administrators). The installed and the latest
 * version, the last check (time and result), "בדוק אם יש עדכון" (the store reload first, then the read), the automatic
 * check interval (כבוי / 1 / 3 / 6 / 12 / 24 hours) and the release notes while an update exists.
 * CR-021 S3: "עדכן" (a plain confirmation with a backup choice) starts a run; the run's status screen replaces the cards until its
 * outcome is closed, and is resumed after a reload (the open run from the state, or the run id kept in sessionStorage); the
 * "הפעלות מחדש" card restarts Arx or the platform. Only the class of a failure is worded here; the infrastructure's own answer never is.
 */
const RUN_KEY = 'sw.update.run';

function storedRun(): string {
  try {
    return sessionStorage.getItem(RUN_KEY) ?? '';
  } catch {
    return '';
  }
}
function keepRun(id: string): void {
  try {
    if (id) sessionStorage.setItem(RUN_KEY, id);
    else sessionStorage.removeItem(RUN_KEY);
  } catch {
    /* no storage: the open run still comes from the state */
  }
}

/** The one-time manual step while the add-on's role is still the default (CR-021 section 4; text only). */
const MANUAL_STEPS = [
  'בתשתית המערכת: הגדרות › תוספים › SmplWise Arx › בדיקת עדכונים.',
  'סמנו "גיבוי לפני העדכון" ולחצו על עדכון. ההתקנה נמשכת כמה דקות.',
  'חזרו לכאן ולחצו "בדוק אם יש עדכון". מכאן והלאה העדכונים יתבצעו מתוך Arx.',
];

@customElement('system-update')
export class SystemUpdate extends LitElement {
  @state() private data: UpdateState | null = null;
  @state() private loadError = '';
  @state() private checking = false;
  @state() private failure: CheckFailure | null = null;
  /** The last manual check ran without the store reload (the infrastructure refused it, the read worked). */
  @state() private degraded = false;
  @state() private savingInterval = false;
  @state() private intervalError = '';
  @state() private tz = 'Asia/Jerusalem';
  /** CR-021 S3: the run the status screen follows ('' = none) and what the caller already knew about it. */
  @state() private runId = '';
  @state() private runHint: Partial<RunView> | null = null;
  @state() private confirmOpen = false;
  @state() private backup = true;
  @state() private applying = false;
  @state() private applyError = '';
  @state() private manualOpen = false;
  private applyKey = '';

  static styles = css`
    :host {
      display: block;
    }
    .rows {
      display: grid;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 0;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .lbl {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
    }
    .val {
      font-weight: var(--sw-fw-semibold);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .ver {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .stack {
      display: grid;
      gap: 12px;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: var(--sw-fw-semibold);
    }
    .status.up {
      color: var(--sw-live);
    }
    .status.avail {
      color: var(--sw-accent-text);
    }
    .msg {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .msg.err {
      color: var(--sw-danger);
    }
    .foot {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-block-start: 12px;
    }
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      background: var(--sw-surface-3);
      border-radius: 12px;
      flex-wrap: wrap;
      max-inline-size: 100%;
    }
    .seg button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      min-block-size: 44px;
      padding: 0 14px;
      border-radius: 9px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .seg button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .seg button[disabled] {
      opacity: 0.6;
      cursor: default;
    }
    .note {
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .note:last-child {
      border-block-end: 0;
    }
    .note h4 {
      margin: 0 0 4px;
      font-size: var(--sw-fs-md);
    }
    .note .txt {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .apply {
      display: grid;
      gap: 8px;
      margin-block-start: 12px;
    }
    ol.how {
      margin: 0;
      padding-inline-start: 22px;
      display: grid;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      cursor: pointer;
      font-size: var(--sw-fs-md);
    }
    .chk input {
      inline-size: 20px;
      block-size: 20px;
      flex: none;
      accent-color: var(--sw-accent);
    }
    .note .txt[lang='en'] {
      direction: ltr;
      text-align: start;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    void productSettings()
      .then((s) => (this.tz = (s['time.zone'] as string | undefined) ?? this.tz))
      .catch(() => undefined);
  }

  private async load() {
    this.loadError = '';
    try {
      const d = await getUpdateState();
      this.data = d;
      notifyUpdateState(d.update_available, d.requires_platform_restart === true);
      const open = d.run?.run_id ?? d.run?.id ?? '';
      if (open && !this.runId) {
        this.runId = open;
        keepRun(open);
      } else if (!this.runId && storedRun()) {
        this.runId = storedRun(); // a reload: the status screen shows the outcome of the run this tab started
      }
    } catch (err) {
      this.loadError = describeError(err);
    }
  }

  private openConfirm() {
    this.backup = true;
    this.applyError = '';
    this.applyKey = newIdempotencyKey();
    this.confirmOpen = true;
  }

  private async confirmApply() {
    const target = this.data?.latest;
    if (this.applying || !target) return;
    this.applying = true;
    this.applyError = '';
    try {
      const run = await applyUpdate({ target_version: target, backup: this.backup, idempotency_key: this.applyKey });
      this.confirmOpen = false;
      this.startRun(run);
    } catch (err) {
      const f = classifyRunError(err);
      this.applyError = runFailureRequestText(f, 'update');
      if (f.kind === 'not_available' || f.kind === 'version_mismatch' || f.kind === 'in_progress') void this.load();
    } finally {
      this.applying = false;
    }
  }

  private startRun(run: RunView) {
    this.runHint = run;
    this.runId = run.run_id;
    keepRun(run.run_id);
  }

  private endRun() {
    this.runId = '';
    this.runHint = null;
    keepRun('');
    void this.load();
  }

  private async check() {
    if (this.checking) return;
    this.checking = true;
    this.failure = null;
    this.degraded = false;
    try {
      const r = await checkForUpdate();
      this.degraded = !r.refreshed || r.check_result === 'refresh_failed_read_ok';
      this.data = { ...(this.data ?? { update_available: false }), installed: r.installed, latest: r.latest, update_available: r.update_available, checked_at: r.checked_at, check_result: r.check_result, permitted: 'yes' };
      notifyUpdateState(r.update_available);
    } catch (err) {
      this.failure = classifyCheckError(err);
      // the server records a failed check too (time and result): read it back, quietly
      void getUpdateState().then((d) => (this.data = d)).catch(() => undefined);
    } finally {
      this.checking = false;
    }
  }

  private async pickInterval(h: number) {
    if (this.savingInterval || !this.data || this.data.interval_hours === h) return;
    this.savingInterval = true;
    this.intervalError = '';
    try {
      const r = await setUpdateInterval(h);
      this.data = { ...this.data, interval_hours: r.interval_hours };
    } catch (err) {
      this.intervalError = describeError(err);
    } finally {
      this.savingInterval = false;
    }
  }

  private when(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, dateStyle: 'short', timeStyle: 'short' }).format(d);
  }

  private failureText(f: CheckFailure): string {
    switch (f.kind) {
      case 'rate_limited':
        return f.wait ? `הבדיקה בוצעה זה עתה. נסו שוב בעוד ${f.wait} שניות.` : 'הבדיקה בוצעה זה עתה. נסו שוב בעוד רגע.';
      case 'not_permitted':
        return 'חסרה הרשאה בתשתית המערכת, ולכן אי אפשר לבדוק עדכונים.';
      case 'unreachable':
        return 'תשתית המערכת אינה זמינה כרגע.';
      default:
        return f.message || 'הבדיקה נכשלה. נסו שוב.';
    }
  }

  private renderStatus(d: UpdateState) {
    if (!d.checked_at) return html`<span class="status" data-update-status="never">טרם בוצעה בדיקה</span>`;
    if (d.update_available) return html`<span class="status avail" data-update-status="available"><sw-icon name="info" size=${16}></sw-icon>יש גרסה חדשה</span>`;
    if (d.check_result === 'not_permitted') return html`<span class="status" data-update-status="not-permitted">אין הרשאה לבדוק</span>`;
    if (d.check_result === 'unreachable' || d.check_result === 'error') return html`<span class="status" data-update-status="failed">לא ניתן לבדוק</span>`;
    return html`<span class="status up" data-update-status="current"><sw-icon name="check" size=${16}></sw-icon>הגרסה מעודכנת</span>`;
  }

  private renderNotes(d: UpdateState) {
    if (!d.update_available) return nothing;
    const notes = d.notes ?? [];
    return html`<sw-card heading="מה חדש" data-update-notes>
      ${notes.length
        ? notes.map(
            (n) => html`<div class="note" data-update-note><h4 class="ver">${n.version}</h4>
              ${n.he ? html`<div class="txt" lang="he">${n.he}</div>` : nothing}${n.en ? html`<div class="txt" lang="en">${n.en}</div>` : nothing}</div>`,
          )
        : html`<p class="msg" data-update-notes-empty>אין פירוט זמין</p>`}
      ${this.renderApply(d)}
    </sw-card>`;
  }

  /** "עדכן" - or, while the add-on's role is still the default, the one-time manual step instead of a button that cannot work. */
  private renderApply(d: UpdateState) {
    const blocked = d.permitted === 'no' || this.failure?.kind === 'not_permitted' || (!this.failure && d.check_result === 'not_permitted');
    if (blocked) {
      return html`<div class="apply" data-update-blocked>
        <p class="msg err">ל-Arx אין הרשאה לעדכן את עצמו. נדרש שינוי חד-פעמי בהגדרות ההתקנה.</p>
        <div class="foot"><sw-button size="sm" data-update-manual-open aria-expanded=${this.manualOpen ? 'true' : 'false'} @click=${() => (this.manualOpen = !this.manualOpen)}>הוראות</sw-button></div>
        ${this.manualOpen ? html`<ol class="how" data-update-manual>${MANUAL_STEPS.map((s) => html`<li>${s}</li>`)}</ol>` : nothing}
      </div>`;
    }
    return html`<div class="foot"><sw-button variant="primary" icon="download" data-update-apply @click=${() => this.openConfirm()}>עדכן</sw-button></div>`;
  }

  private renderConfirm(d: UpdateState) {
    return html`<sw-dialog ?open=${this.confirmOpen} ?locked=${this.applying} heading="לעדכן את SmplWise Arx?" data-update-dialog @close=${() => (this.confirmOpen = false)}>
      <div class="stack">
        <div class="msg ver-line" data-update-dialog-versions>מגרסה <span class="ver">${d.installed ?? '—'}</span> לגרסה <span class="ver">${d.latest ?? '—'}</span></div>
        <div class="msg">המערכת לא תהיה זמינה כמה דקות</div>
        <label class="chk"><input type="checkbox" data-update-backup .checked=${this.backup} ?disabled=${this.applying} @change=${(e: Event) => (this.backup = (e.target as HTMLInputElement).checked)} /><span>צור גיבוי לפני העדכון</span></label>
        ${this.applyError ? html`<p class="msg err" role="alert" data-update-apply-error>${this.applyError}</p>` : nothing}
      </div>
      <div slot="footer">
        <sw-button variant="primary" data-update-confirm ?disabled=${this.applying} @click=${() => void this.confirmApply()}>עדכן עכשיו</sw-button>
        <sw-button variant="ghost" data-update-cancel ?disabled=${this.applying} @click=${() => (this.confirmOpen = false)}>ביטול</sw-button>
      </div>
    </sw-dialog>`;
  }

  render() {
    const d = this.data;
    if (!d) {
      return html`<sw-page heading="עדכונים">
        ${this.loadError
          ? html`<sw-state-panel state="error" heading="לא ניתן לטעון את מצב העדכונים" hint=${this.loadError} actionLabel="נסו שוב" data-update-load-error @action=${() => void this.load()}></sw-state-panel>`
          : html`<sw-state-panel state="loading" data-update-loading></sw-state-panel>`}
      </sw-page>`;
    }
    if (this.runId) {
      return html`<sw-page heading="עדכונים">
        <div class="stack" data-system-update data-update-run-page>
          <sw-update-run .runId=${this.runId} .initial=${this.runHint} @run-dismiss=${() => this.endRun()}></sw-update-run>
        </div>
      </sw-page>`;
    }
    const interval = d.interval_hours ?? 6;
    const notPermitted = this.failure?.kind === 'not_permitted' || (!this.failure && d.check_result === 'not_permitted');
    const last = d.checked_at ? `${this.when(d.checked_at)} · ${resultLabel(d.check_result, d.update_available)}` : 'טרם בוצעה בדיקה';
    return html`<sw-page heading="עדכונים">
      <div class="stack" data-system-update>
        <sw-card heading="גרסה">
          <div class="rows">
            <div class="row"><span class="lbl">גרסה מותקנת</span><span class="val ver" data-update-installed>${d.installed ?? '—'}</span></div>
            <div class="row"><span class="lbl">הגרסה האחרונה</span><span class="val ver" data-update-latest>${d.latest ?? '—'}</span></div>
            <div class="row"><span class="lbl">בדיקה אחרונה</span><span class="val" data-update-last>${last}</span></div>
            <div class="row">${this.renderStatus(d)}</div>
          </div>
          <div class="foot">
            <sw-button variant="primary" size="sm" icon="refresh" data-update-check ?disabled=${this.checking} @click=${() => void this.check()}>${this.checking ? 'בודק…' : 'בדוק אם יש עדכון'}</sw-button>
          </div>
          ${this.failure
            ? html`<p class="msg err" role="alert" data-update-failure=${this.failure.kind}>${this.failureText(this.failure)}</p>`
            : notPermitted
              ? html`<p class="msg err" data-update-failure="not_permitted">${this.failureText({ kind: 'not_permitted' })}</p>`
              : this.degraded
                ? html`<p class="msg" role="status" data-update-degraded>הרשימה לא רועננה, והבדיקה נעשתה לפי המצב הנוכחי. ייתכן שגרסה חדשה עוד לא מופיעה.</p>`
                : nothing}
        </sw-card>
        <sw-card heading="בדיקה אוטומטית" data-update-interval-card>
          <div class="seg" role="group" aria-label="תדירות בדיקה אוטומטית" data-update-interval>
            ${INTERVAL_CHOICES.map(
              (h) => html`<button type="button" data-update-interval-option=${h} aria-pressed=${interval === h ? 'true' : 'false'} ?disabled=${this.savingInterval} @click=${() => void this.pickInterval(h)}>${intervalLabel(h)}</button>`,
            )}
          </div>
          ${this.intervalError ? html`<p class="msg err" role="alert" data-update-interval-error>${this.intervalError}</p>` : nothing}
        </sw-card>
        ${this.renderNotes(d)}
        <sw-restarts-card ?required=${d.requires_platform_restart === true} @run-started=${(e: CustomEvent<RunView>) => this.startRun(e.detail)}></sw-restarts-card>
      </div>
      ${this.renderConfirm(d)}
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-update': SystemUpdate;
  }
}
