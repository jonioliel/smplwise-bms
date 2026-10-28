import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { settingsLadderStyles } from '../styles/settings';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { can, isApi } from '../api/session';
import {
  DATASET_TEXT, DEMO_HOURS, KPI_ORDER, KPI_TEXT, LEVEL_TEXT, SCENARIO_TEXT, STATUS_TEXT, THRESHOLD_FIELDS,
  attestHandover, changedSettings, demoReadiness, filterChecks, gainText, getDemo, getReadiness, kpiCounts, levelTone, points, runReadinessCheck,
  saveReadinessSettings, setReadinessChip, startDemo, validSetting, weightKey,
  type DemoDataset, type DemoInfo, type DemoScenario, type KpiKey, type ReadinessCheck, type ReadinessReport, type ReadinessStatus,
} from '../api/readiness';
import { SkinController } from '../design/skin';

const STATUS_ICON: Record<ReadinessStatus, string> = { ok: 'check', attention: 'info', blocked: 'warning', pending: 'clock', not_applicable: 'minus' };
const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;
type Pane = 'checks' | 'steps' | 'handover';

function when(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** הגדרות › מוכנות (CR-READY96 slice 1, owner-approved mockup 24.10): one score for how complete and how safe the installation is, the checklist behind it
 * with one next step per row, the steps ranked by the points they add, the hand-over card and the history.
 *   - the hand-over threshold is ADVICE: "רישום מסירה" is never disabled by the score (the card says when it is recorded below the advice);
 *   - every threshold and weight is editable in "הגדרות סף" (a dialog; the server validates and audits);
 *   - the page never scrolls: the header, the hero and the filters keep their height, the checklist and the side column scroll inside their panels
 *     (on a phone one pane at a time, switched by a segmented control);
 *   - readable only by whoever configures the system; the demo button needs demo.run (a sensitive permission in no built-in role).
 * One screen: the fleet monitoring report (CR-FLEET215) reads the same score from the server and shows no second readiness page. */
@customElement('system-readiness')
export class SystemReadiness extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private report: ReadinessReport | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private busy = false;
  @state() private note = '';
  @state() private kpi: KpiKey = 'all';
  @state() private pane: Pane = 'checks';
  @state() private customer = '';
  @state() private printed = false;
  @state() private handoverNote = '';
  @state() private settingsOpen = false;
  @state() private draft: Record<string, string> = {};
  @state() private settingsError = '';
  @state() private demoOpen = false;
  @state() private demo: DemoInfo | null = null;
  @state() private demoSet: { dataset: DemoDataset; scenario: DemoScenario; hours: number } = { dataset: 'residential', scenario: 'normal', hours: 4 };
  @state() private demoError = '';

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    this.error = '';
    if (!isApi()) {
      this.report = demoReadiness();
      return;
    }
    try {
      this.report = await getReadiness();
      setReadinessChip(this.report);
      this.forbidden = false;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else this.error = describeError(err);
    }
  }

  private async checkAll() {
    if (this.busy) return;
    this.busy = true;
    this.note = '';
    try {
      if (!isApi()) {
        await new Promise((r) => setTimeout(r, 400));
        this.report = demoReadiness();
      } else {
        this.report = await runReadinessCheck();
        setReadinessChip(this.report);
      }
    } catch (err) {
      this.note = err instanceof ApiError && err.status === 429 ? `הבדיקה הורצה הרגע. אפשר שוב בעוד ${(err.body.details?.retry_after_s as number | undefined) ?? 30} שנ׳.` : describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async recordHandover(done: boolean) {
    if (this.busy) return;
    this.busy = true;
    this.note = '';
    try {
      if (isApi()) {
        this.report = await attestHandover(done, this.customer, this.handoverNote, this.printed);
        setReadinessChip(this.report);
      } else this.report = { ...demoReadiness(), handover: { ...demoReadiness().handover, done } };
    } catch (err) {
      this.note = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private openSettings() {
    if (!this.report) return;
    this.draft = { ...this.report.settings };
    this.settingsError = '';
    this.settingsOpen = true;
  }

  private setDraft(key: string, value: string) {
    this.draft = { ...this.draft, [key]: value };
  }

  private async saveSettings() {
    if (!this.report) return;
    const changes = changedSettings(this.report.settings, this.draft);
    if (!Object.keys(changes).length) {
      this.settingsOpen = false;
      return;
    }
    for (const [k, v] of Object.entries(changes)) {
      if (!validSetting(k, v)) {
        this.settingsError = 'ערך לא תקין: יש להזין מספר שלם בטווח המותר.';
        return;
      }
    }
    this.busy = true;
    try {
      if (isApi()) await saveReadinessSettings(changes);
      this.settingsOpen = false;
      await this.load();
    } catch (err) {
      this.settingsError = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async openDemo() {
    this.demoError = '';
    this.demoOpen = true;
    if (isApi()) {
      try {
        this.demo = await getDemo();
      } catch (err) {
        this.demoError = describeError(err);
      }
    }
  }

  private async confirmDemo() {
    this.busy = true;
    this.demoError = '';
    try {
      if (isApi()) {
        await startDemo(this.demoSet.dataset, this.demoSet.scenario, this.demoSet.hours);
        window.location.reload(); // every screen and cache now reads the demo database
      } else {
        this.demoOpen = false;
      }
    } catch (err) {
      this.demoError = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- render

  private ring(r: ReadinessReport) {
    const dash = (RING_C * r.score) / 100;
    return html`<div class="ring" data-tone=${levelTone(r.level)} role="img" aria-label=${`ציון מוכנות ${r.score} מתוך 100`} data-score-ring>
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r=${RING_R}></circle><circle class="fg" cx="60" cy="60" r=${RING_R} stroke-dasharray=${`${dash} ${RING_C}`}></circle></svg>
      <div class="v"><b data-score>${r.score}</b><small>מתוך 100</small></div>
    </div>`;
  }

  private hero(r: ReadinessReport) {
    const names = r.handover.blockers.map((id) => r.checks.find((c) => c.id === id)?.title ?? id);
    const prev = r.history[1];
    return html`<section class="panel hero" data-tone=${levelTone(r.level)} data-hero>
      ${this.ring(r)}
      <div class="lvl">
        <div class="name"><span data-level>${LEVEL_TEXT[r.level]}</span>${names.length ? html`<span class="badge blocked" data-blockers><sw-icon name="warning" size=${12}></sw-icon>${names.length === 1 ? 'חסם אחד' : `${names.length} חסמים`}</span>` : nothing}</div>
        <div class="hint" data-advice>מסירה ללקוח מומלצת מציון ${r.bands.advice} ובלי חסמים. זו המלצה בלבד: אפשר למסור גם קודם, והמסירה תירשם עם הציון שהיה.</div>
        <div class="scale" aria-hidden="true"><span class=${r.score >= 0 ? 'on' : ''}></span><span class=${r.score >= r.bands.almost_min ? 'on' : ''}></span><span class=${r.score >= r.bands.advice ? 'on' : ''}></span></div>
        <div class="scale-l" aria-hidden="true"><span>בהקמה · 0-${r.bands.almost_min - 1}</span><span>כמעט מוכן · ${r.bands.almost_min}-${r.bands.advice - 1}</span><span>מוכן למסירה · ${r.bands.advice}+</span></div>
        <div class="gates">${names.map((n) => html`<span class="chip blocked">חסם: ${n}</span>`)}${prev ? html`<span class="chip">ציון קודם: ${prev.score} (${when(prev.at)})</span>` : nothing}</div>
      </div>
    </section>`;
  }

  private kpis(r: ReadinessReport) {
    const n = kpiCounts(r.checks);
    return html`<div class="kpis" role="group" aria-label="סינון לפי מצב" data-kpis>
      ${KPI_ORDER.map((k) => html`<button type="button" class="kpi" data-k=${k} data-look=${k} aria-pressed=${this.kpi === k ? 'true' : 'false'} @click=${() => (this.kpi = k)}><span class="dot" aria-hidden="true"></span><div><b>${n[k]}</b><span class="l">${KPI_TEXT[k]}</span></div></button>`)}
    </div>`;
  }

  private row(c: ReadinessCheck) {
    const p = points(c);
    const pct = c.fraction === null ? 0 : Math.round(c.fraction * 100);
    return html`<article class="row" data-check=${c.id} data-status=${c.status}>
      <span class="disc" data-status=${c.status} aria-hidden="true"><sw-icon name=${STATUS_ICON[c.status] as 'check'} size=${14}></sw-icon></span>
      <div class="main">
        <div class="t"><h3>${c.title}</h3><span class="badge ${c.status}" data-check-status>${STATUS_TEXT[c.status]}</span>${c.critical ? html`<span class="chip crit">קריטי</span>` : nothing}<span class="chip">${c.source === 'computed' ? 'נמדד' : 'מאושר ידנית'}</span></div>
        <p class="sum">${c.summary}</p>
        ${c.applicable ? html`<div class="bar" aria-hidden="true"><i style=${`inline-size:${pct}%`}></i></div>` : nothing}
        ${c.facts.length ? html`<div class="facts">${c.facts.slice(0, 4).map((f) => html`<span class="chip ${f.ok === false ? 'warn' : f.ok ? 'good' : ''}">${f.label}: ${f.value}</span>`)}</div>` : nothing}
      </div>
      <div class="end">${c.applicable ? html`<span class="pts" data-points>${p.got}/${p.of}</span>` : nothing}${c.next ? html`<a class=${`go ${c.status === 'blocked' ? 'pri' : ''}`} href=${c.next.href} data-next-link>${c.next.label} ‹</a>` : nothing}</div>
    </article>`;
  }

  private checks(r: ReadinessReport) {
    const list = filterChecks(r.checks, this.kpi);
    return html`<section class="col checks" data-checks aria-label="הבדיקות">
      ${list.length ? repeat(list, (c) => c.id, (c) => this.row(c)) : html`<sw-state-panel icon="rule" state="empty" compact heading="אין בדיקות במצב הזה"></sw-state-panel>`}
    </section>`;
  }

  private steps(r: ReadinessReport) {
    return html`<div class="panel" data-steps><div class="hd"><h2>הצעדים הבאים</h2><span class="mut">לפי תרומה לציון</span></div>
      ${r.next_steps.length
        ? html`<ol class="next">${r.next_steps.map((s, i) => html`<li><span class="n">${i + 1}</span><a href=${s.href} data-step-link><b>${s.title}</b><span>${s.label}</span></a>${s.gain ? html`<span class="gain" data-gain>${gainText(s.gain)}</span>` : nothing}</li>`)}</ol>`
        : html`<p class="mut">אין צעדים פתוחים.</p>`}
    </div>`;
  }

  private handoverCard(r: ReadinessReport) {
    const h = r.handover;
    const done = h.done;
    return html`<div class="panel" data-handover><div class="hd"><h2>מסירה ללקוח</h2><span class="chip ${done ? 'good' : ''}" data-handover-state>${done ? 'נרשמה' : 'ממתין'}</span></div>
      <p class="mut">${h.advice_met ? `הציון עומד בהמלצה (${h.advice_score}+) וללא חסמים.` : `המלצה: ציון ${h.advice_score}+ וללא חסמים. אפשר לרשום מסירה גם קודם.`}</p>
      ${done
        ? nothing
        : html`<div class="form"><label>שם הלקוח<input class="inp" type="text" maxlength="120" .value=${this.customer} @input=${(e: Event) => (this.customer = (e.target as HTMLInputElement).value)} data-customer></label>
            <label class="inline"><input type="checkbox" .checked=${this.printed} @change=${(e: Event) => (this.printed = (e.target as HTMLInputElement).checked)}>המדריך המודפס נמסר</label></div>`}
      ${!done && !h.advice_met ? html`<p class="warn" data-below-advice><sw-icon name="info" size=${13}></sw-icon>המסירה תירשם כמוקדמת: ציון ${r.score}${h.blockers.length ? ` ו־${h.blockers.length} חסמים` : ''}.</p>` : nothing}
      <div class="btns"><sw-button size="sm" variant=${done ? 'secondary' : 'primary'} ?disabled=${this.busy} data-handover-btn @click=${() => void this.recordHandover(!done)}>${done ? 'ביטול רישום המסירה' : h.advice_met ? 'רישום מסירה' : 'רישום מסירה מוקדמת'}</sw-button></div>
    </div>`;
  }

  private historyCard(r: ReadinessReport) {
    return html`<div class="panel" data-history><div class="hd"><h2>היסטוריה</h2></div>
      ${r.history.length
        ? html`<ul class="hist">${r.history.map((x, i) => html`<li><span class="dot ${x.level}"></span><span class="t">ציון ${x.score} · ${LEVEL_TEXT[x.level]}${i === 0 ? ' (אחרון)' : ''}</span><span class="w">${when(x.at)}</span></li>`)}</ul>`
        : html`<p class="mut">עדיין לא נרשם ציון. "בדוק הכול" רושם את הראשון.</p>`}
    </div>`;
  }

  private settingsDialog(r: ReadinessReport) {
    return html`<sw-dialog ?open=${this.settingsOpen} wide heading="הגדרות סף ומשקלים" subheading="כל הספים והמשקלים של המוכנות. נשמר בהתקנה ונרשם באודיט." ?locked=${this.busy} @close=${() => (this.settingsOpen = false)} data-settings-dialog>
      <div class="sform">
        ${THRESHOLD_FIELDS.map((f) => html`<label><span>${f.label}</span><span class="u"><input class="inp num" inputmode="numeric" .value=${this.draft[f.key] ?? ''} @input=${(e: Event) => this.setDraft(f.key, (e.target as HTMLInputElement).value.trim())} data-setting=${f.key}>${f.unit}</span></label>`)}
        <h4>משקל כל בדיקה (0 = לא נספרת)</h4>
        ${r.checks.map((c) => html`<label><span>${c.title}</span><span class="u"><input class="inp num" inputmode="numeric" .value=${this.draft[weightKey(c.id)] ?? ''} @input=${(e: Event) => this.setDraft(weightKey(c.id), (e.target as HTMLInputElement).value.trim())} data-setting=${weightKey(c.id)}>נק׳</span></label>`)}
        ${this.settingsError ? html`<p class="err" role="alert" data-settings-error>${this.settingsError}</p>` : nothing}
      </div>
      <div slot="footer" class="dfoot"><sw-button variant="ghost" @click=${() => (this.settingsOpen = false)}>ביטול</sw-button><sw-button variant="primary" ?disabled=${this.busy} data-settings-save @click=${() => void this.saveSettings()}>שמירה</sw-button></div>
    </sw-dialog>`;
  }

  private demoDialog() {
    const d = this.demo;
    const blocked = isApi() && d !== null && !d.can_run;
    return html`<sw-dialog ?open=${this.demoOpen} heading="מצב הדגמה" subheading="התקנה לדוגמה על מסד נתונים נפרד" ?locked=${this.busy} @close=${() => (this.demoOpen = false)} data-demo-dialog>
      <div class="sform">
        <label><span>מערך נתונים</span><select class="inp" .value=${this.demoSet.dataset} @change=${(e: Event) => (this.demoSet = { ...this.demoSet, dataset: (e.target as HTMLSelectElement).value as DemoDataset })} data-demo-dataset>${(d?.datasets ?? (['residential', 'office', 'retail'] as DemoDataset[])).map((x) => html`<option value=${x} ?selected=${this.demoSet.dataset === x}>${DATASET_TEXT[x]}</option>`)}</select></label>
        <label><span>תרחיש</span><select class="inp" .value=${this.demoSet.scenario} @change=${(e: Event) => (this.demoSet = { ...this.demoSet, scenario: (e.target as HTMLSelectElement).value as DemoScenario })} data-demo-scenario>${(d?.scenarios ?? (['normal', 'cameras_offline', 'new_installation'] as DemoScenario[])).map((x) => html`<option value=${x} ?selected=${this.demoSet.scenario === x}>${SCENARIO_TEXT[x]}</option>`)}</select></label>
        <label><span>משך</span><select class="inp" .value=${String(this.demoSet.hours)} @change=${(e: Event) => (this.demoSet = { ...this.demoSet, hours: Number((e.target as HTMLSelectElement).value) })} data-demo-hours>${DEMO_HOURS.map((h) => html`<option value=${h} ?selected=${this.demoSet.hours === h}>${h === 24 ? 'עד 24 שעות (מקסימום)' : `${h} ש׳`}</option>`)}</select></label>
        <p class="warn"><sw-icon name="warning" size=${14}></sw-icon>הנתונים מדומים ונפרדים מההתקנה האמיתית. פעולות למצלמות, לדלתות ולמכשירים חסומות. כל המשתמשים רואים שההדגמה פועלת. ההדגמה מסתיימת בעצמה, ואיתחול המערכת מסיים אותה. הפעלה ויציאה נרשמות באודיט.</p>
        ${blocked ? html`<p class="err" role="alert" data-demo-denied>אין לך הרשאה להפעיל הדגמה (נדרשת ההרשאה "הפעלת מצב הדגמה").</p>` : nothing}
        ${this.demoError ? html`<p class="err" role="alert" data-demo-error>${this.demoError}</p>` : nothing}
      </div>
      <div slot="footer" class="dfoot"><sw-button variant="ghost" @click=${() => (this.demoOpen = false)}>ביטול</sw-button><sw-button variant="primary" icon="play" ?disabled=${this.busy || blocked} data-demo-start @click=${() => void this.confirmDemo()}>הפעלת הדגמה</sw-button></div>
    </sw-dialog>`;
  }

  render() {
    const r = this.report;
    const sub = r ? `מערכת · ${r.checks.length} בדיקות · הבדיקות קוראות בלבד מהמכשירים · נבדק ${when(r.checked_at)}${isApi() ? '' : ' · נתוני הדגמה'}` : 'מערכת · הבדיקות קוראות בלבד מהמכשירים';
    return html`<sw-page heading="מוכנות ההתקנה" subheading=${sub}>
      <span slot="actions" class="acts">
        ${isApi() && !can('demo.run') ? nothing : html`<sw-button icon="play" ?disabled=${!r} data-open-demo @click=${() => void this.openDemo()}>מצב הדגמה</sw-button>`}
        <sw-button icon="wrench" ?disabled=${!r} data-open-settings @click=${() => this.openSettings()}>הגדרות סף</sw-button>
        <sw-button variant="primary" icon="refresh" ?disabled=${!r || this.busy} data-check-all @click=${() => void this.checkAll()}>${this.busy ? 'בודק…' : 'בדוק הכול'}</sw-button>
      </span>
      ${this.forbidden
        ? html`<sw-state-panel state="forbidden" heading="אין הרשאה למסך הזה" hint="מוכנות ההתקנה פתוחה למי שמגדיר את המערכת."></sw-state-panel>`
        : this.error
          ? html`<sw-state-panel state="error" heading="מצב המוכנות לא נטען" hint=${this.error} actionLabel="ניסיון חוזר" @action=${() => void this.load()}></sw-state-panel>`
          : !r
            ? html`<sw-state-panel state="loading" heading="קורא את מצב ההתקנה…"></sw-state-panel>`
            : html`<div class="fit" data-readiness>
                ${this.note ? html`<p class="note" role="status" data-note>${this.note}</p>` : nothing}
                ${this.hero(r)}${this.kpis(r)}
                <div class="panes" role="tablist" aria-label="חלוקת המסך" data-panes>
                  ${(['checks', 'steps', 'handover'] as Pane[]).map((p) => html`<button type="button" role="tab" aria-selected=${this.pane === p ? 'true' : 'false'} @click=${() => (this.pane = p)}>${p === 'checks' ? 'בדיקות' : p === 'steps' ? 'צעדים' : 'מסירה והיסטוריה'}</button>`)}
                </div>
                <div class="cols" data-pane=${this.pane}>
                  ${this.checks(r)}
                  <div class="col side">${this.steps(r)}${this.handoverCard(r)}${this.historyCard(r)}</div>
                </div>
              </div>`}
      ${r ? this.settingsDialog(r) : nothing}${this.demoDialog()}
    </sw-page>`;
  }

  static styles = [settingsLadderStyles, css`
    :host {
      display: block;
      block-size: 100%;
      min-block-size: 0;
      overflow: hidden;
    }
    sw-page {
      block-size: 100%;
      min-block-size: 0;
      overflow: hidden;
    }
    .acts {
      display: contents;
    }
    .fit {
      flex: 1;
      min-block-size: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .note {
      margin: 0;
      padding: 6px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
    }
    /* R5-SYSTEM-297: the panels take the card step (the ladder's shadow 2 + light line, the large radius) */
    .panel {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      padding: 14px 16px;
    }
    /* the score is the one primary object of the page: the hero panel, a 120 px ring with a 40/800 figure */
    .hero {
      flex: none;
      display: flex;
      align-items: center;
      gap: 22px;
      padding: 16px 20px;
    }
    .ring {
      position: relative;
      flex: none;
      inline-size: 120px;
      block-size: 120px;
    }
    .ring svg {
      inline-size: 100%;
      block-size: 100%;
      transform: rotate(-90deg);
    }
    .ring circle {
      fill: none;
      stroke-width: 10;
    }
    .ring .bg {
      stroke: var(--sw-surface-3);
    }
    .ring .fg {
      stroke: var(--sw-danger);
      stroke-linecap: round;
      transition: stroke-dasharray var(--sw-t-fast) var(--sw-ease);
    }
    .ring[data-tone='warning'] .fg {
      stroke: var(--sw-warning);
    }
    .ring[data-tone='success'] .fg {
      stroke: var(--sw-success);
    }
    .ring .v {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
    }
    .ring .v b {
      font-size: 40px;
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.04em;
      line-height: 1;
      color: var(--sw-heading, var(--sw-text));
      font-variant-numeric: tabular-nums;
    }
    .ring .v small {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .lvl {
      min-inline-size: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .name {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.02em;
      color: var(--sw-heading, var(--sw-text));
    }
    .hint {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
    }
    .scale {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      margin-block-start: 2px;
    }
    .scale span {
      block-size: 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
    .scale span.on {
      background: var(--sw-accent);
    }
    .scale-l {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      font-size: var(--sw-fs-2xs);
      color: var(--sw-text-3);
    }
    .gates {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .badge,
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 18px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .badge.blocked {
      background: var(--sw-danger);
      color: var(--sw-text-inverse);
    }
    .badge.attention {
      background: var(--sw-warning);
      color: var(--sw-text-inverse);
    }
    .badge.ok {
      background: var(--sw-success);
      color: var(--sw-text-inverse);
    }
    .badge.pending {
      background: var(--sw-unknown);
      color: var(--sw-text-inverse);
    }
    .badge.not_applicable {
      background: var(--sw-offline-soft);
      color: var(--sw-offline-text);
    }
    .chip.blocked,
    .chip.crit {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .chip.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .chip.good {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .kpis {
      flex: none;
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    /* the six counters are keys one step below the hero: surface-2 wells with a 22/800 figure, the chosen one a filled accent field;
       they give on press, and hover stays with a pointer that hovers */
    .kpi {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      flex: 1 0 auto;
      min-inline-size: 104px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      font-size: var(--sw-fs-base);
      color: var(--sw-text-2);
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    .kpi b {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.02em;
      color: var(--sw-heading, var(--sw-text));
      font-variant-numeric: tabular-nums;
    }
    @media (hover: hover) and (pointer: fine) {
      .kpi:hover {
        background: var(--sw-surface-2);
        box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      }
    }
    .kpi:active {
      transform: scale(var(--sw-press-scale));
    }
    @media (prefers-reduced-motion: reduce) {
      .kpi {
        transition-duration: 0ms;
      }
    }
    .kpi:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent));
      outline-offset: var(--sw-focus-offset, 2px);
    }
    .kpi[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .kpi .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-accent);
      flex: none;
    }
    .kpi[data-look='blocked'] .dot {
      background: var(--sw-danger);
    }
    .kpi[data-look='attention'] .dot {
      background: var(--sw-warning);
    }
    .kpi[data-look='ok'] .dot {
      background: var(--sw-success);
    }
    .kpi[data-look='pending'] .dot {
      background: var(--sw-unknown);
    }
    .kpi[data-look='not_applicable'] .dot {
      background: var(--sw-offline);
    }
    .kpi b {
      display: block;
      font-size: var(--sw-fs-lg);
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading, var(--sw-text));
      line-height: 1.1;
    }
    .kpi .l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .panes {
      display: none;
    }
    .cols {
      flex: 1;
      min-block-size: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 10px;
    }
    .col {
      min-block-size: 0;
      min-inline-size: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      scrollbar-width: thin;
    }
    .col > * {
      flex: none;
    }
    .row {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .row[data-status='blocked'] {
      border-color: var(--sw-danger);
    }
    .disc {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: 26px;
      block-size: 26px;
      border-radius: 50%;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .disc[data-status='ok'] {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .disc[data-status='attention'] {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .disc[data-status='blocked'] {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .main {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .t {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    h3,
    h2,
    h4 {
      margin: 0;
    }
    h3 {
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--sw-text));
    }
    h2 {
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--sw-text));
    }
    .sum {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .bar {
      block-size: 5px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
    }
    .row[data-status='blocked'] .bar i {
      background: var(--sw-danger);
    }
    .row[data-status='ok'] .bar i {
      background: var(--sw-success);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .end {
      flex: none;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
    }
    .pts {
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    a.go {
      display: inline-flex;
      align-items: center;
      min-block-size: 28px;
      padding-inline: 10px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
      white-space: nowrap;
    }
    a.go.pri {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    a.go:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent));
      outline-offset: var(--sw-focus-offset, 2px);
    }
    .hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-block-end: 8px;
    }
    .mut {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin: 0;
    }
    .next {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .next li {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .next .n {
      flex: none;
      inline-size: 20px;
      block-size: 20px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .next a {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      color: inherit;
      text-decoration: none;
      font-size: var(--sw-fs-sm);
    }
    .next a span {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .gain {
      color: var(--sw-success-text);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-block-end: 8px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    label.inline {
      flex-direction: row;
      align-items: center;
      gap: 6px;
    }
    .inp {
      min-block-size: 32px;
      padding: 0 10px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    .inp:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent));
      outline-offset: 0;
    }
    .inp.num {
      inline-size: 88px;
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .warn {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin: 0 0 8px;
      padding: 6px 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
    }
    .err {
      margin: 0;
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    .btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .hist {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .hist li {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .hist .dot {
      flex: none;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-danger);
    }
    .hist .dot.almost {
      background: var(--sw-warning);
    }
    .hist .dot.ready {
      background: var(--sw-success);
    }
    .hist .t {
      flex: 1;
    }
    .hist .w {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .sform {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-block: 4px;
    }
    .sform label {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
    .sform .u {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .sform select.inp {
      inline-size: 200px;
    }
    .sform h4 {
      margin-block-start: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-heading, var(--sw-text));
    }
    .dfoot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    @media (max-width: 899px) {
      .hero {
        gap: 12px;
        padding: 10px 12px;
      }
      .ring {
        inline-size: 72px;
        block-size: 72px;
      }
      .ring .v b {
        font-size: var(--sw-fs-2xl);
      }
      .ring .v small,
      .scale-l,
      .hint {
        display: none;
      }
      .name {
        font-size: var(--sw-fs-lg);
      }
      .kpi {
        min-inline-size: 92px;
        padding: 6px 10px;
      }
      .panes {
        flex: none;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        padding: 3px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-3);
      }
      .panes button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
        text-align: center;
        padding: 6px 4px;
        border-radius: var(--sw-r-sm);
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .panes button[aria-selected='true'] {
        background: var(--sw-surface);
        color: var(--sw-text);
        font-weight: var(--sw-fw-semibold);
        box-shadow: var(--sw-shadow-1);
      }
      .cols {
        grid-template-columns: minmax(0, 1fr);
      }
      .cols[data-pane='checks'] > .side,
      .cols[data-pane='steps'] > .checks,
      .cols[data-pane='handover'] > .checks {
        display: none;
      }
      .cols[data-pane='steps'] .side > [data-handover],
      .cols[data-pane='steps'] .side > [data-history],
      .cols[data-pane='handover'] .side > [data-steps] {
        display: none;
      }
      .row {
        flex-wrap: wrap;
      }
      .end {
        flex-direction: row;
        align-items: center;
        inline-size: 100%;
        justify-content: space-between;
      }
    }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    'system-readiness': SystemReadiness;
  }
}
