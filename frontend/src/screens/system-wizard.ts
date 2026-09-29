import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { demoSetupState, setupCheck, setupState, STATUS_TEXT, type SetupState, type SetupStep, type StepId } from '../api/setup';

/** Tells the shell's "השלם את ההתקנה" hint what the wizard just learned, so it does not wait for its own next read. */
export function announceSetup(s: SetupState) {
  window.dispatchEvent(new CustomEvent('sw-setup-state', { detail: { ready: s.ready, done: s.done, total: s.total, next: s.next } }));
}

const STATUS_ICON: Record<SetupStep['status'], string> = { done: 'check', todo: 'info', failed: 'warning', skipped: 'minus', not_applicable: 'minus' };
const SOURCE_TEXT: Record<SetupStep['source'], string> = { live: 'נבדק מול המכשיר', background: 'לפי עבודות הרקע של ה־Add-on', local: 'לפי בסיס הנתונים של ה־Add-on' };

/** Signed numbers inside Hebrew text ("+03:00", "-45 שנ׳") render as "03:00+" in an RTL run: a left-to-right mark
 * before the sign keeps them together (the same fix as i18n/bidi.ts, for either sign). */
function b(text: string): string {
  return text.replace(/(^|[^\w\u200E])([+-]\d)/g, '$1\u200E$2');
}

function when(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** SC26 — setup wizard (T071): install → NVR → Home Assistant → go2rtc → floor → camera, each with its live status,
 * the evidence, the explanation and next action when it is not done, "בדוק שוב" and a link to the settings that fix it.
 * Device checks are read-only (GET /setup/state never probes; POST /setup/check/{step} does, rate-limited). */
@customElement('system-wizard')
export class SystemWizard extends LitElement {
  @state() private data: SetupState | null = null;
  @state() private error = '';
  @state() private busy = new Set<StepId>();
  @state() private notes: Partial<Record<StepId, string>> = {};
  private demoPlaced = false;

  connectedCallback() {
    super.connectedCallback();
    void this.load(true);
  }

  private set(s: SetupState) {
    this.data = s;
    this.error = '';
    if (isApi()) announceSetup(s);
  }

  private async load(autoCheck = false) {
    if (!isApi()) {
      this.set(demoSetupState(this.demoPlaced));
      return;
    }
    try {
      this.set(await setupState());
    } catch (err) {
      this.error = describeError(err);
      return;
    }
    // opening the wizard reads each device once: a step known only from the background jobs gets its live check
    if (autoCheck) for (const s of this.data?.steps ?? []) if (s.source === 'background' && s.status !== 'not_applicable') void this.check(s.id, true);
  }

  private async check(id: StepId, quiet = false) {
    if (this.busy.has(id)) return;
    this.busy = new Set(this.busy).add(id);
    this.notes = { ...this.notes, [id]: '' };
    try {
      if (!isApi()) {
        await new Promise((r) => setTimeout(r, 500));
        if (id === 'camera') this.demoPlaced = true;
        this.set(demoSetupState(this.demoPlaced, id));
      } else {
        this.merge(await setupCheck(id), id);
      }
    } catch (err) {
      const retry = err instanceof ApiError && err.status === 429;
      if (!(quiet && retry)) this.notes = { ...this.notes, [id]: describeError(err) };
    } finally {
      const next = new Set(this.busy);
      next.delete(id);
      this.busy = next;
      // once the last check is back, one read brings the dependent parts up to date (the camera step after the NVR one,
      // the NVR-HA clock gap) - never a response of a check that ran alongside others
      if (!next.size && isApi()) void this.load(false);
    }
  }

  /** Only the checked step is taken from a check's response: with "בדוק הכול" the responses arrive in any order, and each
   * one's copy of the other steps may predate their own checks. */
  private merge(s: SetupState, id: StepId) {
    const fresh = s.steps.find((x) => x.id === id);
    if (!this.data || !fresh) {
      this.set(s);
      return;
    }
    const steps = this.data.steps.map((x) => (x.id === id ? fresh : x));
    const required = steps.filter((x) => x.status !== 'not_applicable'); // NVR-less mode: a step skipped on purpose is not counted
    const done = required.filter((x) => x.status === 'done').length;
    this.set({ ...this.data, steps, done, total: required.length, ready: done === required.length, next: required.find((x) => x.status !== 'done')?.id ?? null, checked_at: s.checked_at, checked: id });
  }

  private checkAll() {
    for (const s of this.data?.steps ?? []) if (s.status !== 'not_applicable') void this.check(s.id);
  }

  private jump(id: StepId) {
    this.renderRoot.querySelector(`[data-step="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private renderRail(d: SetupState) {
    return html`<ol class="rail" aria-label="שלבי ההתקנה" data-wizard-rail>
      ${d.steps.map((s) => html`<li class=${s.status} data-rail-step=${s.id} data-status=${s.status}>
        <button type="button" @click=${() => this.jump(s.id)} aria-label=${`${s.index}. ${s.title}: ${STATUS_TEXT[s.status]}`}>
          <span class="dot">${s.status === 'done' ? html`<sw-icon name="check" size=${13}></sw-icon>` : s.status === 'failed' ? '!' : s.index}</span>
          <span class="lbl">${s.title}</span>
        </button>
      </li>`)}
    </ol>`;
  }

  private renderSummary(d: SetupState) {
    const skipped = d.steps.filter((s) => s.status === 'not_applicable').length;
    if (d.ready && d.mode === 'ha_only') {
      return html`<div class="summary ready" role="status" data-wizard-ready data-wizard-mode="ha_only">
        <span class="big"><sw-icon name="check" size=${22}></sw-icon></span>
        <div class="txt"><b>מוכן לעבודה</b><span>כל ${d.total} השלבים הנדרשים עברו · ${skipped} דולגו (מצב ללא NVR) · נבדק ${when(d.checked_at)}</span></div>
        <div class="go">
          <sw-button size="sm" variant="primary" icon="map" @click=${() => (window.location.hash = '#/explore/sites')}>למפה</sw-button>
          <sw-button size="sm" icon="bolt" @click=${() => (window.location.hash = '#/devices/building')}>לחשמל והתקנים</sw-button>
        </div>
      </div>`;
    }
    if (d.ready) {
      return html`<div class="summary ready" role="status" data-wizard-ready>
        <span class="big"><sw-icon name="check" size=${22}></sw-icon></span>
        <div class="txt"><b>מוכן לעבודה</b><span>${skipped ? `כל ${d.total} השלבים הנדרשים עברו · ${skipped} דולגו` : 'כל ששת השלבים עברו'} · נבדק ${when(d.checked_at)}</span></div>
        <div class="go">
          <sw-button size="sm" variant="primary" icon="live" @click=${() => (window.location.hash = '#/live/wall')}>לכל המצלמות</sw-button>
          <sw-button size="sm" icon="map" @click=${() => (window.location.hash = '#/explore/sites')}>למפה</sw-button>
          <sw-button size="sm" icon="list" @click=${() => (window.location.hash = '#/investigate/events')}>לאירועים</sw-button>
        </div>
      </div>`;
    }
    const next = d.steps.find((s) => s.id === d.next);
    const failed = d.steps.filter((s) => s.status === 'failed').length;
    return html`<div class="summary" role="status" data-wizard-progress>
      <span class="count"><b>${d.done}</b>/${d.total}</span>
      <div class="txt"><b>${d.done} מתוך ${d.total} שלבים הושלמו${failed ? ` · ${failed} נכשלו` : ''}${skipped ? ` · ${skipped} דולגו${d.mode === 'ha_only' ? ' (מצב ללא NVR)' : ''}` : ''}</b>${next ? html`<span>השלב הבא: ${next.index}. ${next.title} — ${b(next.summary)}</span>` : nothing}</div>
      ${next ? html`<div class="go"><sw-button size="sm" variant="primary" @click=${() => this.jump(next.id)}>לשלב ${next.index}</sw-button></div>` : nothing}
    </div>`;
  }

  private renderStep(s: SetupStep) {
    const busy = this.busy.has(s.id);
    const note = this.notes[s.id];
    return html`<section class="step ${s.status}" data-step=${s.id} data-status=${s.status} data-source=${s.source} aria-labelledby=${`h-${s.id}`}>
      <header>
        <span class="num">${s.index}</span>
        <div class="head">
          <h3 id=${`h-${s.id}`}>${s.title}</h3>
          <span class="meta">${SOURCE_TEXT[s.source]}${s.checked_at ? ` · ${when(s.checked_at)}` : ''}</span>
        </div>
        <span class="pill ${s.status}" data-step-status><sw-icon name=${STATUS_ICON[s.status] as 'check'} size=${13}></sw-icon>${s.status_label ?? STATUS_TEXT[s.status]}</span>
        ${s.status === 'not_applicable' ? nothing : html`<sw-button size="sm" icon="refresh" ?disabled=${busy} data-check=${s.id} @click=${() => this.check(s.id)}>${busy ? 'בודק…' : 'בדוק שוב'}</sw-button>`}
      </header>
      <p class="sum" data-step-summary>${b(s.summary)}</p>
      ${s.problem
        ? html`<div class="problem ${s.status}" role=${s.status === 'failed' ? 'alert' : 'note'} data-step-problem=${s.problem.code}>
            <sw-icon name=${s.status === 'failed' ? 'warning' : 'info'} size=${16}></sw-icon>
            <div>
              <b>${b(s.problem.message)}</b>
              <span data-step-action>מה עושים: ${b(s.problem.action)}</span>
              ${s.problem.link ? html`<a href=${s.problem.link.href} data-step-link>${s.problem.link.label} ›</a>` : nothing}
            </div>
          </div>`
        : nothing}
      ${note ? html`<div class="note" data-step-note>${note}</div>` : nothing}
      ${s.warnings.length
        ? html`<ul class="warnings" data-step-warnings>${s.warnings.map((w) => html`<li data-warning=${w.code}><sw-icon name="info" size=${13}></sw-icon><span>${b(w.message)}${w.link ? html` <a href=${w.link.href}>${w.link.label} ›</a>` : nothing}</span></li>`)}</ul>`
        : nothing}
      ${s.facts.length
        ? html`<dl class="facts" data-step-facts>${s.facts.map((f) => html`<div class="fact"><dt>${f.label}</dt><dd class=${f.tone}>${b(f.value)}</dd></div>`)}</dl>`
        : nothing}
      <div class="foot"><a href=${s.settings_link.href} data-settings-link>${s.settings_link.label} ›</a></div>
    </section>`;
  }

  render() {
    const d = this.data;
    const anyBusy = this.busy.size > 0;
    const sub = d?.mode === 'ha_only' ? 'מצב ללא NVR · התקנה › Home Assistant › go2rtc › קומה · שלבי ה־NVR והמצלמה מדולגים' : 'התקנה › NVR › Home Assistant › go2rtc › קומה › מצלמה';
    return html`<sw-page heading="אשף התקנה" subheading=${`${sub} · הבדיקות קוראות בלבד מהמכשירים${isApi() ? '' : ' · נתוני הדגמה'}`}>
      <sw-button slot="actions" icon="refresh" ?disabled=${!d || anyBusy} data-check-all @click=${() => this.checkAll()}>${anyBusy ? 'בודק…' : 'בדוק הכול'}</sw-button>
      ${this.error ? html`<sw-state-panel state="error" heading="מצב ההתקנה לא נטען" hint=${this.error}></sw-state-panel>` : nothing}
      ${!d
        ? this.error ? nothing : html`<sw-state-panel state="loading" heading="קורא את מצב ההתקנה…"></sw-state-panel>`
        : html`<div class="wrap" data-wizard>
            ${this.renderRail(d)}
            ${this.renderSummary(d)}
            ${d.steps.map((s) => this.renderStep(s))}
            <p class="hint">סטיית שעון עד ${d.thresholds.drift_ok_s} שנ׳ תקינה, עד ${d.thresholds.drift_fail_s} שנ׳ אזהרה, מעבר לזה השלב נכשל. "בדוק שוב" אפשרי פעם ב־${d.check_every_s} שנ׳ לכל שלב; בדיקה מול מכשיר מוצגת ${Math.round(d.live_ttl_s / 60)} דקות.</p>
          </div>`}
    </sw-page>`;
  }

  static styles = css`
    .wrap {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-inline-size: 920px;
    }
    .rail {
      list-style: none;
      margin: 0;
      padding: 12px 14px;
      display: flex;
      gap: 4px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 12px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .rail li {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      align-items: flex-start;
      position: relative;
    }
    .rail li:not(:last-child)::after {
      content: '';
      position: absolute;
      inset-inline-start: calc(50% + 18px);
      inset-inline-end: calc(-50% + 18px);
      inset-block-start: 14px;
      block-size: 2px;
      background: var(--sw-border);
    }
    .rail li.done:not(:last-child)::after {
      background: var(--sw-live);
    }
    .rail button {
      all: unset;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      inline-size: 100%;
      text-align: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .rail button:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
      border-radius: 6px;
    }
    .dot {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
      position: relative;
      z-index: 1;
    }
    .done .dot {
      background: var(--sw-live);
      border-color: var(--sw-live);
      color: #fff;
    }
    .failed .dot {
      background: var(--sw-danger);
      border-color: var(--sw-danger);
      color: #fff;
    }
    .todo .dot {
      border-color: var(--sw-warning);
      color: var(--sw-warning);
    }
    .lbl {
      overflow: hidden;
      text-overflow: ellipsis;
      max-inline-size: 100%;
    }
    .summary {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .summary.ready {
      background: var(--sw-live-soft);
      border-color: var(--sw-live);
    }
    .summary .big {
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border-radius: 50%;
      background: var(--sw-live);
      color: #fff;
    }
    .summary .count {
      font-size: var(--sw-fs-lg);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .summary .count b {
      font-size: var(--sw-fs-xl);
      color: var(--sw-heading, var(--sw-text));
    }
    .summary .txt {
      flex: 1;
      min-inline-size: 200px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: var(--sw-fs-sm);
    }
    .summary .txt span {
      color: var(--sw-text-2);
    }
    .summary .go {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .step {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-inline-start: 4px solid var(--sw-border-strong);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      scroll-margin-block-start: 12px;
    }
    .step.done {
      border-inline-start-color: var(--sw-live);
    }
    .step.failed {
      border-inline-start-color: var(--sw-danger);
    }
    .step.todo {
      border-inline-start-color: var(--sw-warning);
    }
    .step header {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .num {
      display: grid;
      place-items: center;
      inline-size: 26px;
      block-size: 26px;
      border-radius: 50%;
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .head {
      flex: 1;
      min-inline-size: 160px;
      display: flex;
      flex-direction: column;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .pill.done {
      background: var(--sw-live-soft);
      color: var(--sw-success, #15803d);
    }
    .pill.failed {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .pill.todo {
      background: var(--sw-warning-soft);
      color: var(--sw-warning);
    }
    .pill.not_applicable {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .step.not_applicable {
      opacity: 0.85;
    }
    .problem.not_applicable {
      background: var(--sw-surface-2);
    }
    .sum {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      overflow-wrap: anywhere;
    }
    .problem {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--sw-warning-soft);
      font-size: var(--sw-fs-sm);
      line-height: 1.55;
    }
    .problem.failed {
      background: var(--sw-danger-soft);
    }
    .problem sw-icon {
      flex: none;
      margin-block-start: 2px;
      color: var(--sw-warning);
    }
    .problem.failed sw-icon {
      color: var(--sw-danger);
    }
    .problem div {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    a {
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .warnings {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .warnings li {
      display: flex;
      gap: 6px;
      align-items: flex-start;
      overflow-wrap: anywhere;
    }
    .warnings sw-icon {
      flex: none;
      color: var(--sw-warning);
      margin-block-start: 1px;
    }
    .facts {
      margin: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 24px;
    }
    .fact {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .fact dt {
      color: var(--sw-text-3);
    }
    .fact dd {
      margin: 0;
      color: var(--sw-text-2);
      text-align: end;
      overflow-wrap: anywhere;
      min-inline-size: 0;
    }
    dd.ok {
      color: var(--sw-success, #15803d);
    }
    dd.warn {
      color: var(--sw-warning);
    }
    dd.err {
      color: var(--sw-danger);
      font-weight: var(--sw-fw-semibold);
    }
    .foot {
      font-size: var(--sw-fs-xs);
    }
    .hint {
      margin: 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .rail {
        padding: 10px 8px;
      }
      .lbl {
        display: none;
      }
      .rail li:not(:last-child)::after {
        inset-inline-start: calc(50% + 16px);
        inset-inline-end: calc(-50% + 16px);
      }
      .facts {
        grid-template-columns: 1fr;
      }
      .step {
        padding: 12px;
      }
      .step header sw-button {
        margin-inline-start: auto;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'system-wizard': SystemWizard;
  }
}
