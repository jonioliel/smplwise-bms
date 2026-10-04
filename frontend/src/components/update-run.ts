import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-card';
import './sw-icon';
import { ApiError } from '../api/client';
import { getUpdateState } from '../api/system-update';
import { ROLLBACK_STEPS, getRun, isTerminal, needsRollbackGuidance, runFailureText, runSteps, type RunKind, type RunView } from '../api/system-update-runs';

/** The page that follows one run: shown while it runs (also across the restart of Arx), then its outcome. Events: `run-dismiss` (the person closes the outcome). */
const POLL_FAST_MS = 2_000;
const POLL_SLOW_MS = 15_000;
/** How long the screen waits for the system to answer again before it says so (the design's window for a locally built image). */
export const WAIT_LIMIT_UPDATE_MS = 20 * 60_000;
export const WAIT_LIMIT_RESTART_MS = 10 * 60_000;

/** An answer that means "the system is down or restarting", not "the run is unknown". */
export function isOutageError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 401 || err.status === 502 || err.status === 503 || err.status === 504 || err.status === 0 || err.code.startsWith('http_5');
  return true; // a TypeError from fetch: the connection is down
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * הגדרות › עדכונים: the status screen of an update or a platform restart (CR-021 S3 design section 6). The SPA bundle is already
 * in the browser, so the screen keeps running while Arx is down: any network error, 401, 502 or 503 is "ממתין לחזרת המערכת" with a
 * back-off from 2 to 15 seconds. Every text of a failure and the rollback guidance is in this bundle (Arx may be down when it is needed).
 * When an update finished on a version other than the bundle's own, the page reloads itself once (the parent shows the outcome again from
 * the stored run id).
 */
@customElement('sw-update-run')
export class SwUpdateRun extends LitElement {
  @property() runId = '';
  /** What the caller knew when it started the run (shown until the first answer). */
  @property({ attribute: false }) initial: Partial<RunView> | null = null;
  /** Tests: shorter limits. */
  @property({ type: Number }) waitLimitMs = 0;
  @state() private run: RunView | null = null;
  @state() private waiting = false;
  @state() private gaveUp = false;
  @state() private guidance = false;
  @state() private now = Date.now();
  @state() private notFound = false;
  /** After a success: the platform still needs a restart (a flagged release, the bridge copied) - the outcome says so, the restart stays a separate press. */
  @state() private restartNeeded = false;
  private timer = 0;
  private tick = 0;
  private delay = POLL_FAST_MS;
  private downSince = 0;
  private stopped = false;

  static styles = css`
    :host {
      display: block;
    }
    .stack {
      display: grid;
      gap: 12px;
    }
    .steps {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 44px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-md);
    }
    .step .mk {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-3);
    }
    .step.done {
      color: var(--sw-text-2);
    }
    .step.done .mk {
      background: var(--sw-live);
      border-color: var(--sw-live);
      color: #fff;
    }
    .step.current {
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .step.current .mk {
      border-color: var(--sw-accent);
      background: var(--sw-accent);
      color: #fff;
    }
    .step.current .mk sw-icon {
      animation: spin 1.2s linear infinite;
    }
    .step.failed .mk {
      background: var(--sw-danger);
      border-color: var(--sw-danger);
      color: #fff;
    }
    .step.failed {
      color: var(--sw-danger-text, var(--sw-danger));
      font-weight: var(--sw-fw-semibold);
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .step.current .mk sw-icon {
        animation: none;
      }
    }
    .meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding-block-start: 8px;
      border-block-start: 1px solid var(--sw-border);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
    }
    .meta .t {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-semibold);
    }
    .wait {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--sw-warning-text, var(--sw-text-2));
      font-weight: var(--sw-fw-semibold);
    }
    .outcome {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
    }
    .outcome.ok {
      color: var(--sw-live);
    }
    .outcome.bad {
      color: var(--sw-danger);
    }
    .reason {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      overflow-wrap: anywhere;
    }
    .ver {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .foot {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    /* touch layouts: every button is a 44 px target (the inner button stretches to the host) */
    @media (max-width: 1100px) {
      sw-button {
        min-block-size: 44px;
      }
    }
    ol.how {
      margin: 0;
      padding-inline-start: 22px;
      display: grid;
      gap: 8px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.stopped = false;
    this.tick = window.setInterval(() => (this.now = Date.now()), 1000);
    void this.poll();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopped = true;
    window.clearTimeout(this.timer);
    window.clearInterval(this.tick);
  }

  private limit(): number {
    if (this.waitLimitMs > 0) return this.waitLimitMs;
    const kind: RunKind = this.run?.kind ?? (this.initial?.kind as RunKind | undefined) ?? 'update';
    return kind === 'update' ? WAIT_LIMIT_UPDATE_MS : WAIT_LIMIT_RESTART_MS;
  }

  private async poll() {
    if (this.stopped || !this.runId) return;
    try {
      const r = await getRun(this.runId);
      this.run = r;
      this.waiting = false;
      this.downSince = 0;
      this.delay = POLL_FAST_MS;
      if (isTerminal(r.state)) {
        this.afterSettled(r);
        return;
      }
    } catch (err) {
      if (!isOutageError(err)) {
        if (err instanceof ApiError && err.status === 404) this.notFound = true;
        this.waiting = false;
        if (!this.run) this.gaveUp = true;
        return;
      }
      this.waiting = true;
      if (!this.downSince) this.downSince = Date.now();
      this.delay = Math.min(POLL_SLOW_MS, Math.round(this.delay * 1.5));
      if (Date.now() - this.downSince > this.limit()) {
        this.gaveUp = true;
        this.waiting = false;
        return;
      }
    }
    this.timer = window.setTimeout(() => void this.poll(), this.delay);
  }

  /** An update that finished on another version than this bundle's: the page loads the new bundle once. */
  private afterSettled(r: RunView) {
    if (r.kind === 'update' && r.state === 'succeeded') {
      void getUpdateState()
        .then((s) => (this.restartNeeded = s.requires_platform_restart === true))
        .catch(() => undefined);
    }
    if (r.kind !== 'update' || r.state !== 'succeeded' || !r.to_version) return;
    let build = '';
    try {
      build = typeof __ARX_BUILD__ === 'string' ? __ARX_BUILD__ : '';
    } catch {
      return;
    }
    if (!build || build === r.to_version) return;
    try {
      const key = 'sw.update.reloaded';
      if (sessionStorage.getItem(key) === r.run_id) return;
      sessionStorage.setItem(key, r.run_id);
    } catch {
      return; // no storage, no guard against a reload loop: stay
    }
    window.location.reload();
  }

  private dismiss() {
    this.dispatchEvent(new CustomEvent('run-dismiss', { bubbles: true, composed: true, detail: { run: this.run } }));
  }

  private elapsed(): string {
    const start = Date.parse(this.run?.started_at ?? (this.initial?.started_at as string | undefined) ?? '');
    return mmss(Number.isNaN(start) ? 0 : this.now - start);
  }

  private view(): Pick<RunView, 'kind' | 'state' | 'backup' | 'error_code'> {
    const r = this.run ?? this.initial;
    return { kind: (r?.kind as RunKind) ?? 'update', state: (r?.state as RunView['state']) ?? 'requested', backup: !!r?.backup, error_code: (r?.error_code as string | null) ?? null };
  }

  private renderGuidance() {
    return html`<sw-card heading="הוראות שחזור" data-run-guidance>
      <ol class="how">${ROLLBACK_STEPS.map((s) => html`<li>${s}</li>`)}</ol>
    </sw-card>`;
  }

  private renderOutcome(v: ReturnType<SwUpdateRun['view']>) {
    const r = this.run;
    const update = v.kind === 'update';
    if (r?.state === 'succeeded') {
      return html`<sw-card data-run-state="succeeded">
        <div class="stack">
          <div class="outcome ok"><sw-icon name="check" size=${22}></sw-icon><span data-run-outcome>${update ? html`המערכת עודכנה לגרסה <span class="ver">${r.to_version ?? ''}</span>` : 'תשתית המערכת הופעלה מחדש'}</span></div>
          ${update && this.restartNeeded ? html`<p class="reason" data-run-restart-needed>נדרשת הפעלה מחדש של תשתית המערכת</p>` : nothing}
          <div class="foot"><sw-button variant="primary" data-run-continue @click=${() => this.dismiss()}>המשך</sw-button></div>
        </div>
      </sw-card>`;
    }
    const failed = this.gaveUp && !r ? ({ kind: v.kind, state: 'abandoned', error_code: 'timeout' } as const) : this.gaveUp && r && !isTerminal(r.state) ? ({ kind: r.kind, state: 'abandoned', error_code: 'timeout' } as const) : (r ?? v);
    const state = r && isTerminal(r.state) ? r.state : 'abandoned';
    const text = this.notFound ? 'הפעולה לא נמצאה.' : runFailureText(failed as Pick<RunView, 'kind' | 'state' | 'error_code'>);
    const guide = update && needsRollbackGuidance(failed as Pick<RunView, 'kind' | 'state' | 'error_code'>);
    const title = state === 'abandoned' ? (update ? 'העדכון לא הסתיים' : 'ההפעלה מחדש לא הסתיימה') : update ? 'העדכון נכשל' : 'ההפעלה מחדש נכשלה';
    const code = (failed as { error_code?: string | null }).error_code ?? state;
    return html`<div class="stack" data-run-state=${state === 'abandoned' ? 'abandoned' : 'failed'} data-run-error=${code}>
      <sw-card>
        <div class="stack">
          <div class="outcome bad"><sw-icon name="warning" size=${22}></sw-icon><span data-run-outcome>${title}</span></div>
          <p class="reason" data-run-reason>${text}</p>
          <div class="foot">
            ${guide ? html`<sw-button data-run-guidance-open aria-expanded=${this.guidance ? 'true' : 'false'} @click=${() => (this.guidance = !this.guidance)}>הוראות שחזור</sw-button>` : nothing}
            <sw-button variant="primary" data-run-close @click=${() => this.dismiss()}>סגור</sw-button>
          </div>
        </div>
      </sw-card>
      ${guide && this.guidance ? this.renderGuidance() : nothing}
    </div>`;
  }

  render() {
    const v = this.view();
    const r = this.run;
    if ((r && isTerminal(r.state)) || this.gaveUp || this.notFound) return this.renderOutcome(v);
    const { steps, current } = runSteps(v);
    const timeout = r?.timeout_s ?? (this.initial?.timeout_s as number | undefined);
    return html`<sw-card data-run-state=${r?.state ?? 'requested'} data-run-kind=${v.kind}>
      <div class="stack">
        <ol class="steps" data-run-steps>
          ${steps.map(
            (s, i) => html`<li class="step ${i < current ? 'done' : i === current ? 'current' : ''}" data-run-step=${s.id} data-run-step-state=${i < current ? 'done' : i === current ? 'current' : 'pending'}>
              <span class="mk">${i < current ? html`<sw-icon name="check" size=${14}></sw-icon>` : i === current ? html`<sw-icon name="refresh" size=${14}></sw-icon>` : nothing}</span><span>${s.label}</span>
            </li>`,
          )}
        </ol>
        ${this.waiting ? html`<div class="wait" role="status" data-run-waiting><sw-icon name="clock" size=${18}></sw-icon>ממתין לחזרת המערכת…</div>` : nothing}
        <div class="meta">
          <span>זמן שעבר</span><span class="t" data-run-elapsed>${this.elapsed()}</span>
        </div>
        ${v.kind === 'platform_restart' && timeout ? html`<span class="reason" data-run-expect>עשוי להימשך עד ${Math.max(1, Math.round(timeout / 60))} דקות</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-update-run': SwUpdateRun;
  }
}
