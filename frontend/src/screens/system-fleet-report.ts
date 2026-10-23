import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { ApiError } from '../api/client';
import { fleetApi, type FleetEnrollment, type FleetLogRow, type FleetStatus, type ReadinessView } from '../api/fleet-report';
import { settingsStyles } from '../styles/settings';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { ft, pickLang } from '../i18n/fleet-report';
import {
  FIELD_COUNT, FIELD_GROUPS, FIELD_TYPE_KEY, NEVER_SENT, answerOf, logLines, readyTitle, shortCode, shortId, silentProblem, viewOf,
} from '../fleet/fleet-model';

/**
 * CR-FLEET215: Settings › דיווח בריאות (`#/system/fleet-report`) - the installation side of the daily health report to SmplWise.
 * Written for the simplest technician (owner-approved mock-up docs/design/mockups/fleet-215, v2): the FIRST screen answers one question -
 * is the report on, and what do I do - with the switch and "send now" visible without scrolling, then the readiness to-do list; everything
 * else is three folded cards (what is sent, the last reports, the connection details). Real components and the settings stylesheet only.
 *
 * The customer's system administrator sees exactly what leaves: the list of the 52 fields (grouped, technical names behind one toggle)
 * and the exact body of the last report. Nothing here edits the report's content - the schema is closed on the server. Switching the
 * report off sends one last signed "reporting stopped" message (the server does it); the silence threshold is an editable installation
 * setting. Reads and writes need system.configure at installation scope AND a system administrator (the server decides; a 403 is shown).
 * The receiver's overview page is a separate service and is not built here.
 */
@customElement('system-fleet-report')
export class SystemFleetReport extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private loadState: 'loading' | 'ready' | 'forbidden' | 'error' = 'loading';
  @state() private status: FleetStatus | null = null;
  @state() private log: FleetLogRow[] = [];
  @state() private readiness: ReadinessView | null = null;
  @state() private readinessFailed = false;
  @state() private demoOn = false;
  @state() private enrollment: FleetEnrollment | null = null;
  @state() private busy = false;
  @state() private flash: { tone: 'ok' | 'err'; text: string } | null = null;
  @state() private techNames = false;
  @state() private exact: 'last' | 'next' = 'last';
  @state() private nextBody: Record<string, unknown> | null = null;
  @state() private nextFailed = false;
  @state() private silentDraft: string | null = null;
  @state() private silentError = '';
  @state() private copied: 'idle' | 'ok' | 'fail' = 'idle';
  private flashTimer = 0;
  private copyTimer = 0;

  static styles = [settingsStyles, css`
    .sections {
      max-inline-size: 880px;
    }
    .flash {
      margin: 0;
    }
    .answer {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--sw-s-3);
      align-items: center;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: var(--sw-r-md);
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .ic.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .ic.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .ic.mute {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .t {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-xl);
      line-height: 1.25;
      color: var(--sw-heading, var(--sw-text));
      overflow-wrap: anywhere;
    }
    .s {
      margin-block-start: 2px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-base);
      line-height: 1.45;
    }
    .do {
      margin-block-start: 6px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-base);
      line-height: 1.45;
    }
    .do.bad {
      color: var(--sw-danger-text);
    }
    .do.warn {
      color: var(--sw-warning-text);
    }
    .act {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--sw-s-2);
    }
    .tog {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
    }
    .ready {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      margin-block-end: var(--sw-s-2);
    }
    .ring {
      --v: 0;
      inline-size: 56px;
      block-size: 56px;
      border-radius: 50%;
      flex: none;
      display: grid;
      place-items: center;
      background: conic-gradient(var(--sw-accent) calc(var(--v) * 1%), var(--sw-surface-3) 0);
    }
    .ring b {
      inline-size: 44px;
      block-size: 44px;
      border-radius: 50%;
      background: var(--sw-surface);
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-base);
      font-variant-numeric: tabular-nums;
    }
    h3.rt {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .rt .csub {
      display: block;
      margin-block-start: 2px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-3);
      line-height: 1.45;
    }
    .check .m {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-weight: var(--sw-fw-medium);
    }
    .check .m .muted {
      font-weight: var(--sw-fw-regular);
    }
    .chip {
      display: inline-block;
      margin-inline-start: 6px;
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    a.link {
      flex: none;
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
      white-space: nowrap;
    }
    a.link:hover {
      text-decoration: underline;
    }
    a.link:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .tools {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      margin-block-end: var(--sw-s-2);
    }
    .tools .grow {
      flex: 1;
    }
    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 0 var(--sw-s-4);
    }
    .fg {
      padding-block-start: 10px;
      min-inline-size: 0;
    }
    .fg h4 {
      margin: 0 0 2px;
      display: flex;
      justify-content: space-between;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
    }
    .fg h4 .n {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      font-variant-numeric: tabular-nums;
    }
    .fg .gx {
      margin-block-end: 4px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .f {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0 8px;
      padding: 5px 0;
      border-block-end: 1px dashed var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .f .l {
      color: var(--sw-text-2);
    }
    .f .ty {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    .f code {
      display: none;
      grid-column: 1 / -1;
      justify-self: start;
      background: none;
      padding: 0;
      color: var(--sw-text-3);
    }
    .tech .f code {
      display: block;
    }
    .never {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .never li {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 3px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      text-decoration: line-through;
      text-decoration-color: var(--sw-danger);
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th {
      text-align: start;
      padding: 6px 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      border-block-end: 1px solid var(--sw-border);
    }
    td {
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    tr:last-child td {
      border-block-end: 0;
    }
    .num {
      font-variant-numeric: tabular-nums;
    }
    details.exact {
      margin-block-start: var(--sw-s-2);
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: var(--sw-s-2);
    }
    details.exact > summary {
      cursor: pointer;
      min-block-size: 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-base);
    }
    details.exact > summary:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    pre.json {
      margin: var(--sw-s-2) 0 0;
      padding: 12px 14px;
      max-block-size: 300px;
      overflow: auto;
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
      direction: ltr;
      text-align: left;
      font: 12px/1.5 var(--sw-font-mono);
      color: var(--sw-text-2);
    }
    .row .end code {
      max-inline-size: 100%;
      overflow-wrap: anywhere;
    }
    .in {
      inline-size: 84px;
      min-block-size: 36px;
      padding: 0 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-variant-numeric: tabular-nums;
      text-align: center;
    }
    .in:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .in[aria-invalid='true'] {
      border-color: var(--sw-danger);
    }
    .skl {
      display: block;
      block-size: 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-skeleton);
    }
    @media (prefers-reduced-motion: no-preference) {
      .skl {
        background: linear-gradient(90deg, var(--sw-skeleton) 0%, var(--sw-skeleton-shine) 50%, var(--sw-skeleton) 100%);
        background-size: 200% 100%;
        animation: shim 1.3s linear infinite;
      }
    }
    @keyframes shim {
      to {
        background-position: -200% 0;
      }
    }
    @media (max-width: 767px) {
      .answer {
        grid-template-columns: auto minmax(0, 1fr);
      }
      .act {
        grid-column: 1 / -1;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        padding-block-start: var(--sw-s-2);
        border-block-start: 1px solid var(--sw-border);
      }
      .act sw-button {
        flex: 1;
      }
      .t {
        font-size: var(--sw-fs-lg);
      }
      .fields {
        grid-template-columns: 1fr;
      }
    }
  `, bubbleChrome];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.flashTimer);
    window.clearTimeout(this.copyTimer);
  }

  private async load(): Promise<void> {
    this.loadState = 'loading';
    try {
      this.status = await fleetApi.status();
    } catch (e) {
      this.loadState = e instanceof ApiError && e.status === 403 ? 'forbidden' : 'error';
      return;
    }
    this.loadState = 'ready';
    await Promise.all([this.loadLog(), this.loadReadiness(), this.loadDemo()]);
  }

  private async loadLog(): Promise<void> {
    try {
      this.log = (await fleetApi.log()).items;
    } catch {
      this.log = [];
    }
  }

  private async loadReadiness(): Promise<void> {
    try {
      this.readiness = await fleetApi.readiness();
      this.readinessFailed = false;
    } catch {
      this.readiness = null;
      this.readinessFailed = true;
    }
  }

  private async loadDemo(): Promise<void> {
    try {
      this.demoOn = (await fleetApi.demo()).enabled;
    } catch {
      /* the demo row simply stays off */
    }
  }

  private say(tone: 'ok' | 'err', text: string): void {
    this.flash = { tone, text };
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => (this.flash = null), 6000);
  }

  private async setEnabled(on: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      this.status = await fleetApi.setEnabled(on);
      if (!on && this.status.stopped_at) this.say(this.status.stopped_result === 'ok' ? 'ok' : 'err', ft(this.status.stopped_result === 'ok' ? 'stoppedSent' : 'stoppedFail'));
      this.enrollment = null;
      await this.loadLog();
    } catch (e) {
      this.say('err', e instanceof ApiError && e.body.user_message ? e.body.user_message : ft('saveFail'));
    } finally {
      this.busy = false;
    }
  }

  private async sendNow(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const out = await fleetApi.send();
      this.say(out.sent ? 'ok' : 'err', out.sent ? ft('sentOk') : ft('sentFail'));
    } catch (e) {
      this.say('err', e instanceof ApiError && e.body.user_message ? e.body.user_message : ft('sentFail'));
    }
    try {
      this.status = await fleetApi.status();
    } catch {
      /* keep the last known status */
    }
    await this.loadLog();
    this.busy = false;
  }

  private async setDemo(on: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      this.demoOn = (await fleetApi.setDemo(on)).enabled;
    } catch (e) {
      this.say('err', e instanceof ApiError && e.body.user_message ? e.body.user_message : ft('saveFail'));
    } finally {
      this.busy = false;
    }
  }

  private async saveSilent(): Promise<void> {
    const st = this.status;
    if (!st || this.silentDraft === null || this.busy) return;
    const problem = silentProblem(this.silentDraft, st.silent_range_h);
    if (problem) {
      this.silentError = problem;
      return;
    }
    this.busy = true;
    try {
      this.status = await fleetApi.setSilentAfter(Number(this.silentDraft));
      this.silentDraft = null;
      this.silentError = '';
      this.say('ok', ft('silentSaved'));
    } catch (e) {
      this.silentError = e instanceof ApiError && e.body.user_message ? e.body.user_message : ft('saveFail');
    } finally {
      this.busy = false;
    }
  }

  /** The enrollment facts are fetched when the details card is opened (the server creates the key on first use, so never before consent). */
  private async onTechToggle(e: CustomEvent<{ collapsed: boolean }>): Promise<void> {
    if (e.detail.collapsed || this.enrollment || !this.status?.installation_id) return;
    try {
      this.enrollment = await fleetApi.enrollment();
    } catch {
      /* the rows simply stay without the code */
    }
  }

  private async onExactToggle(e: Event): Promise<void> {
    if (!(e.target as HTMLDetailsElement).open || this.log.some((r) => r.payload) || this.nextBody) return;
    await this.loadNext();
  }

  private async loadNext(): Promise<void> {
    this.exact = 'next';
    this.nextFailed = false;
    try {
      this.nextBody = (await fleetApi.preview()).payload;
    } catch {
      this.nextFailed = true;
    }
  }

  private async copyCode(): Promise<void> {
    const code = this.enrollment?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copied = 'ok';
    } catch {
      this.copied = 'fail';
    }
    window.clearTimeout(this.copyTimer);
    this.copyTimer = window.setTimeout(() => (this.copied = 'idle'), 3000);
  }

  // ------------------------------------------------------------------ pieces

  private answerCard(st: FleetStatus): TemplateResult {
    const a = answerOf(st);
    const doCls = a.tone === 'bad' ? 'bad' : a.tone === 'warn' ? 'warn' : '';
    return html`<sw-card data-card="answer">
      <div class="answer" data-answer data-view=${a.view}>
        <div class="ic ${a.tone === 'ok' ? '' : a.tone}" aria-hidden="true"><sw-icon name=${a.icon} size=${24}></sw-icon></div>
        <div style="min-inline-size:0">
          <div class="t" data-answer-title>${a.title}</div>
          <div class="s">${a.sub}</div>
          <div class="do ${doCls}" data-answer-do>${a.doText}</div>
        </div>
        <div class="act">
          <label class="tog"><span>${ft('switchLabel')}</span>
            <sw-toggle data-switch label=${ft('switchLabel')} labelHidden .checked=${st.enabled} ?disabled=${this.busy}
              @change=${(e: CustomEvent<{ checked: boolean }>) => void this.setEnabled(e.detail.checked)}></sw-toggle></label>
          <sw-button size="sm" variant=${a.view === 'failed' ? 'primary' : 'secondary'} data-send ?disabled=${!a.canSend || this.busy} @click=${() => void this.sendNow()}>${this.busy && a.canSend ? ft('sending') : a.view === 'failed' ? ft('sendRetry') : ft('sendNow')}</sw-button>
        </div>
      </div>
    </sw-card>`;
  }

  private readyCard(): TemplateResult | typeof nothing {
    if (this.readinessFailed) return html`<sw-card data-card="ready"><p class="muted" data-ready-failed>${ft('readyUnavailable')}</p></sw-card>`;
    const r = this.readiness;
    if (!r) return nothing;
    const open = r.items.filter((i) => i.met === false);
    // required first, then the heavier ones (the server already orders `missing`)
    const order = new Map(r.missing.map((id, i) => [id, i]));
    open.sort((x, y) => (order.get(x.id) ?? 99) - (order.get(y.id) ?? 99));
    return html`<sw-card data-card="ready">
      <div class="ready" data-ready>
        <div class="ring" style=${`--v:${r.score}`} role="img" aria-label=${`${r.score}%`}><b data-ready-score>${r.score}%</b></div>
        <h3 class="rt"><span data-ready-title>${readyTitle(open.length)}</span><span class="csub">${open.length ? ft('readySub') : ft('readyAllOk')}</span></h3>
      </div>
      ${repeat(open, (i) => i.id, (i) => html`<div class="check" data-ready-item=${i.id}>
        <span class="m"><span>${pickLang(i.label)}${i.required ? html`<span class="chip">${ft('required')}</span>` : nothing}</span>
          ${i.hint ? html`<span class="muted">${pickLang(i.hint)}</span>` : nothing}</span>
        ${i.link?.href ? html`<a class="link" href=${i.link.href}>${ft('goTo')}</a>` : nothing}
      </div>`)}
    </sw-card>`;
  }

  private sentCard(): TemplateResult {
    return html`<sw-card collapsible collapsed data-card="sent" heading=${`${ft('sentTitle')} ${ft('sentCount', { n: FIELD_COUNT })}`} subheading=${ft('sentSub')}>
      <div class="tools"><span class="hint grow">${ft('sentIntro')}</span>
        <sw-button size="sm" variant=${this.techNames ? 'primary' : 'secondary'} data-tech-names aria-pressed=${String(this.techNames)} @click=${() => (this.techNames = !this.techNames)}>${ft('techNames')}</sw-button></div>
      <div class="fields ${this.techNames ? 'tech' : ''}" data-fields data-count=${FIELD_COUNT}>
        ${FIELD_GROUPS.map((g) => html`<div class="fg" data-group=${g.id}>
          <h4><span>${ft(g.title)}</span><span class="n">${g.fields.length}</span></h4>
          ${g.sub ? html`<div class="gx">${ft(g.sub)}</div>` : nothing}
          ${g.fields.map(([label, path, type]) => html`<div class="f" data-field=${path}><span class="l">${label}</span><span class="ty">${ft(FIELD_TYPE_KEY[type])}</span><code>${path}</code></div>`)}
        </div>`)}
      </div>
      <p class="hint" data-header-note>${ft('sentHeader')}</p>
      <div class="grouplabel">${ft('neverTitle')} <span class="muted">· ${ft('neverX')}</span></div>
      <ul class="never" data-never>${NEVER_SENT.map((n) => html`<li>${n}</li>`)}</ul>
    </sw-card>`;
  }

  private lastCard(st: FleetStatus): TemplateResult {
    const a = answerOf(st);
    const lines = logLines(this.log);
    const lastBody = this.log.find((r) => r.payload)?.payload ?? null;
    const showNext = this.exact === 'next' || !lastBody;
    const body = showNext ? this.nextBody : lastBody;
    return html`<sw-card collapsible collapsed data-card="last" heading=${ft('lastTitle')} subheading=${a.lastLine}>
      <table data-log>
        <thead><tr><th>${ft('colWhen')}</th><th>${ft('colWhat')}</th><th>${ft('colSeq')}</th></tr></thead>
        <tbody>${lines.length
          ? lines.map((l) => html`<tr data-log-row><td class="num">${l.when}</td><td><span class="msg ${l.tone === 'mute' ? '' : l.tone === 'bad' ? 'err' : l.tone}">${l.text}</span></td><td class="num">${l.seq}</td></tr>`)
          : html`<tr><td colspan="3" class="muted" data-log-empty>${ft('logEmpty')}</td></tr>`}</tbody>
      </table>
      <div class="hint">${ft('seqHint')}</div>
      <details class="exact" data-exact @toggle=${(e: Event) => void this.onExactToggle(e)}>
        <summary>${ft('exactTitle')}<span class="hint">${ft('exactHint')}</span></summary>
        <div class="tools">
          ${lastBody ? html`<sw-button size="sm" variant=${showNext ? 'secondary' : 'primary'} data-exact-last @click=${() => (this.exact = 'last')}>${ft('exactLast')}</sw-button>` : nothing}
          <sw-button size="sm" variant=${showNext ? 'primary' : 'secondary'} data-exact-next @click=${() => void this.loadNext()}>${ft('exactNow')}</sw-button>
        </div>
        ${body ? html`<pre class="json" data-json tabindex="0">${JSON.stringify(body, null, 2)}</pre>`
          : html`<p class="hint" data-json-empty>${this.nextFailed ? ft('errorTitle') : showNext && !this.nextBody ? ft('exactLoad') : ft('exactNone')}</p>`}
      </details>
    </sw-card>`;
  }

  private techCard(st: FleetStatus): TemplateResult {
    const a = answerOf(st);
    const urlMsg = st.receiver_configured ? html`<span class="msg ok" data-url-state="set">${ft('isSet')}</span>`
      : html`<span class="msg warn" data-url-state=${st.receiver_problem === 'receiver_url_invalid' ? 'invalid' : 'unset'}>${st.receiver_problem === 'receiver_url_invalid' ? ft('invalid') : ft('notSet')}</span>`;
    const e = this.enrollment;
    const silentVal = this.silentDraft ?? String(st.silent_after_h);
    const dirty = this.silentDraft !== null && this.silentDraft !== String(st.silent_after_h);
    return html`<sw-card collapsible collapsed data-card="tech" heading=${ft('techTitle')} subheading=${a.techLine} @sw-card-toggle=${(ev: Event) => void this.onTechToggle(ev as CustomEvent<{ collapsed: boolean }>)}>
      <div class="row"><span class="lbl">${ft('whereTo')}<span class="muted">${ft('whereToHint')}</span></span><span class="end">${urlMsg}</span></div>
      <div class="row"><span class="lbl">${ft('signature')}<span class="muted">${ft('signatureHint')}</span></span>
        <span class="end">${st.kid ? html`<span class="msg ok">${ft('signatureOk')}</span><code data-kid>${st.alg ?? 'Ed25519'} · ${st.kid}</code>` : html`<span class="muted" data-kid-none>${ft('signatureNone')}</span>`}</span></div>
      <div class="row"><span class="lbl">${ft('installId')}<span class="muted">${ft('installIdHint')}</span></span>
        <span class="end">${st.installation_id ? html`<code data-install-id title=${st.installation_id}>${shortId(st.installation_id)}</code>` : html`<span class="muted">${ft('signatureNone')}</span>`}</span></div>
      <div class="row"><span class="lbl">${ft('enrollCode')}<span class="muted">${ft('enrollHint')}</span></span>
        <span class="end">${e ? html`<code data-enroll-code title=${e.code}>${shortCode(e.code)}</code>
          <sw-button size="sm" data-copy @click=${() => void this.copyCode()}>${this.copied === 'ok' ? ft('copied') : ft('copy')}</sw-button>
          ${this.copied === 'fail' ? html`<span class="msg err" role="alert" data-copy-fail>${ft('copyFail')}</span>` : nothing}`
          : html`<span class="muted" data-enroll-none>${ft('signatureNone')}</span>`}</span></div>
      <div class="row"><span class="lbl">${ft('silentLabel')}<span class="muted">${ft('silentHint', { def: st.silent_default_h })}</span>
          ${this.silentError ? html`<span class="field-error" role="alert" data-silent-error>${this.silentError}</span>` : nothing}</span>
        <span class="end"><input class="in" inputmode="numeric" data-silent .value=${silentVal} aria-label=${ft('silentLabel')} aria-invalid=${this.silentError ? 'true' : 'false'} ?disabled=${this.busy}
            @input=${(ev: Event) => { this.silentDraft = (ev.target as HTMLInputElement).value; this.silentError = ''; }}
            @keydown=${(ev: KeyboardEvent) => { if (ev.key === 'Enter') void this.saveSilent(); }} /><span class="muted">${ft('hoursUnit')}</span>
          <sw-button size="sm" variant="primary" data-silent-save ?disabled=${!dirty || this.busy} @click=${() => void this.saveSilent()}>${ft('silentSave')}</sw-button></span></div>
      <div class="row"><span class="lbl">${ft('demoLabel')}<span class="muted">${ft('demoHint')}</span></span>
        <span class="end"><sw-toggle data-demo label=${ft('demoLabel')} labelHidden .checked=${this.demoOn} ?disabled=${this.busy}
          @change=${(ev: CustomEvent<{ checked: boolean }>) => void this.setDemo(ev.detail.checked)}></sw-toggle></span></div>
      <div class="row"><span class="lbl"><span class="muted" data-stop-note>${ft('stopNote')}</span></span></div>
    </sw-card>`;
  }

  render(): TemplateResult {
    const heading = ft('title');
    if (this.loadState === 'loading') {
      return html`<sw-page crumbs="הגדרות" heading=${heading} subheading=${ft('sub')} data-fleet-report data-state="loading">
        <div class="sections"><sw-card><div style="display:grid;gap:14px"><span class="skl" style="inline-size:40%"></span><span class="skl" style="inline-size:70%"></span><span class="skl" style="inline-size:55%"></span></div></sw-card>
        <div class="hint">${ft('loading')}</div></div></sw-page>`;
    }
    if (this.loadState !== 'ready' || !this.status) {
      const forbidden = this.loadState === 'forbidden';
      return html`<sw-page crumbs="הגדרות" heading=${heading} data-fleet-report data-state=${this.loadState}>
        <sw-state-panel state=${forbidden ? 'forbidden' : 'error'} heading=${forbidden ? ft('forbiddenTitle') : ft('errorTitle')} hint=${forbidden ? '' : ft('errorHint')} actionLabel=${forbidden ? '' : ft('retry')}
          @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    }
    const st = this.status;
    return html`<sw-page crumbs="הגדרות" heading=${heading} subheading=${ft('sub')} data-fleet-report data-state="ready" data-view=${viewOf(st)}>
      <div class="sections">
        ${this.flash ? html`<div class="msg ${this.flash.tone} flash" role=${this.flash.tone === 'err' ? 'alert' : 'status'} data-flash>${this.flash.text}</div>` : nothing}
        ${this.answerCard(st)}${this.readyCard()}${this.sentCard()}${this.lastCard(st)}${this.techCard(st)}
      </div>
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-fleet-report': SystemFleetReport;
  }
}
