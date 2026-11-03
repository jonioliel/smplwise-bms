import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-field';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { isApi } from '../api/session';
import { parseRoute } from '../router';
import { printDocument, printHtml } from '../access-control/events-print';
import {
  cancelRun,
  confirmMatches,
  detailLine,
  fetchCsv,
  getRun,
  getValidation,
  runFinished,
  sendPulse,
  sendWitness,
  startRun,
  statusKind,
  type CheckResult,
  type CheckStatus,
  type ValidationOverview,
  type ValidationRun,
  type ValidationStation,
  type WitnessVerdict,
} from '../api/wiskey-validation';
import { formatTime, UTC_ZONE } from './wiskey-format';

const POLL_MS = 1500;
const PHYSICAL = 'פעולה פיזית - דלת תיפתח';
const RUN_STATE_TEXT: Record<string, string> = { running: 'בבדיקה', done: 'הסתיימה', cancelled: 'בוטלה', interrupted: 'נקטעה (הפעלה מחדש)' };
const WITNESS_TEXT: Record<WitnessVerdict, string> = { opened: 'הדלת נפתחה', not_opened: 'הדלת לא נפתחה', unsure: 'לא בטוח' };

/** Demo data (no backend): one finished run of two stations, every kind of result once. */
const DEMO_OVERVIEW: ValidationOverview = {
  feed_state: 'ready',
  stations: [
    { id: 'demo-lobby', name: 'לובי ראשי', online: true, doors: [{ door: 1, name: 'כניסה' }], can_pulse: false },
    { id: 'demo-garage', name: 'חניון', online: true, doors: [], can_pulse: false },
  ],
  checks: [],
  runs: [],
  active_run_id: null,
  rights: { run: false, pulse: false, pulse_local: true },
};
const demoCheck = (check: string, label: string, status: CheckStatus, status_text: string, reason: string | null = null, reason_text: string | null = null): CheckResult => ({
  check, label, status, status_text, reason, reason_text, detail: {}, started_at: null, finished_at: '2026-11-03T10:00:00Z',
});
const DEMO_RUN: ValidationRun = {
  id: 'lv_demo', kind: 'checks', scope: 'all', parent_run_id: null, state: 'done', created_by: 'demo', created_by_name: 'הדגמה', created_at: '2026-11-03T09:59:00Z',
  finished_at: '2026-11-03T10:00:00Z', cancel_requested: false, station_count: 2, counts: { pending: 0, running: 0, pass: 9, fail: 2, unsupported: 2, not_run: 3 },
  progress: { done: 16, total: 16 }, pulses: [],
  stations: [
    { station_id: 'demo-lobby', name: 'לובי ראשי', counts: { pending: 0, running: 0, pass: 6, fail: 1, unsupported: 1, not_run: 0 }, progress: { done: 8, total: 8 }, checks: [
      demoCheck('identity', 'זהות העמדה', 'pass', 'עבר'), demoCheck('door_capabilities', 'יכולות הדלת', 'pass', 'עבר'), demoCheck('door_read', 'קריאת הגדרות הדלת', 'pass', 'עבר'),
      demoCheck('media_arx', 'תמונה דרך Arx', 'pass', 'עבר'), demoCheck('media_wiskey', 'תמונה דרך WisKey', 'unsupported', 'לא נתמך ב-WisKey', 'not_listed', 'WisKey אינו מפרסם את פקודות המדיה בערוץ השירות.'),
      demoCheck('talk', 'זמינות דיבור', 'fail', 'נכשל', 'provider_local', 'מקור הווידאו והדיבור מוגדר Arx, ולכן WisKey לא נבדק כאן.'), demoCheck('events', 'זרם אירועים', 'pass', 'עבר'),
      demoCheck('clock', 'סטיית שעון', 'pass', 'עבר')] },
    { station_id: 'demo-garage', name: 'חניון', counts: { pending: 0, running: 0, pass: 3, fail: 1, unsupported: 1, not_run: 3 }, progress: { done: 8, total: 8 }, checks: [
      demoCheck('identity', 'זהות העמדה', 'not_run', 'לא הורץ', 'relay_map_missing', 'לעמדה אין שיוך דלתות מאושר, ולכן WisKey לא יכול לבדוק אותה. שייכו דלתות במסך שיוך דלתות.'),
      demoCheck('door_capabilities', 'יכולות הדלת', 'not_run', 'לא הורץ', 'relay_map_missing', 'לעמדה אין שיוך דלתות מאושר, ולכן WisKey לא יכול לבדוק אותה. שייכו דלתות במסך שיוך דלתות.'),
      demoCheck('door_read', 'קריאת הגדרות הדלת', 'not_run', 'לא הורץ', 'relay_map_missing', 'לעמדה אין שיוך דלתות מאושר, ולכן WisKey לא יכול לבדוק אותה. שייכו דלתות במסך שיוך דלתות.'),
      demoCheck('media_arx', 'תמונה דרך Arx', 'pass', 'עבר'), demoCheck('media_wiskey', 'תמונה דרך WisKey', 'unsupported', 'לא נתמך ב-WisKey', 'not_listed', 'WisKey אינו מפרסם את פקודות המדיה בערוץ השירות.'),
      demoCheck('talk', 'זמינות דיבור', 'pass', 'עבר'), demoCheck('events', 'זרם אירועים', 'pass', 'עבר'),
      demoCheck('clock', 'סטיית שעון', 'fail', 'נכשל', 'skew_over_tolerance', 'שעון העמדה סוטה מעבר ל-2 שניות.')] },
  ],
};

interface PulseDraft {
  station: ValidationStation;
  door: number;
  witness: string;
  typed: string;
}

/**
 * הגדרות › "בדיקת קבלה לעמדות" (WISKEY-LIVE-VALIDATION-2390, WisKey plan T16), #/system/wiskey-validation[?station=<id>]. The installer's
 * acceptance checklist per station: identity, door capabilities, door read (WisKey's live_validation feature), a still through Arx and
 * through WisKey, talk availability, the event stream and the clock drift - each pass / fail with its reason / not supported by WisKey /
 * not run. Runs only when someone presses a button (one station or all), shows its progress, keeps every run, exports CSV and prints
 * (PDF through the browser). The optional door pulse is a separate, physical action: system administrators on a local session, typed
 * confirmation per station, a named witness, never part of "run all"; the result passes only when the witness saw the door open.
 */
@customElement('system-wiskey-validation')
export class SystemWiskeyValidation extends LitElement {
  @state() private data: ValidationOverview | null = null;
  @state() private run: ValidationRun | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private busy = false;
  @state() private note = '';
  @state() private pulse: PulseDraft | null = null;
  @state() private pulseError = '';
  @state() private focusStation = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.focusStation = parseRoute().params.get('station') ?? '';
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopPolling();
  }

  private stopPolling(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private async load(): Promise<void> {
    if (!isApi()) {
      this.data = DEMO_OVERVIEW;
      this.run = DEMO_RUN;
      return;
    }
    try {
      const data = await getValidation();
      this.data = data;
      this.forbidden = false;
      this.error = '';
      const id = data.active_run_id ?? (this.run && data.runs.some((r) => r.id === this.run?.id) ? this.run.id : data.runs[0]?.id);
      if (id) await this.openRun(id);
      else this.run = null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.forbidden = true;
      else this.error = describeError(e);
    }
  }

  private async openRun(id: string): Promise<void> {
    this.stopPolling();
    try {
      this.run = await getRun(id);
    } catch (e) {
      this.note = describeError(e);
      return;
    }
    if (this.run && !runFinished(this.run)) this.timer = setTimeout(() => void this.poll(), POLL_MS);
  }

  private async poll(): Promise<void> {
    this.timer = null;
    if (!this.run || !this.isConnected) return;
    try {
      const run = await getRun(this.run.id);
      this.run = run;
      if (runFinished(run)) {
        this.data = await getValidation();
        return;
      }
    } catch {
      /* a missed poll: the next one tries again */
    }
    this.timer = setTimeout(() => void this.poll(), POLL_MS);
  }

  private async start(body: { station_id: string } | { all: true }): Promise<void> {
    if (!isApi() || this.busy) return;
    this.busy = true;
    this.note = '';
    try {
      const { run_id } = await startRun(body);
      await this.openRun(run_id);
      this.data = await getValidation();
    } catch (e) {
      this.note = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async cancel(): Promise<void> {
    if (!this.run) return;
    try {
      await cancelRun(this.run.id);
      this.note = 'הבקשה לעצור נשלחה: הבדיקה תיעצר לפני הצעד הבא.';
    } catch (e) {
      this.note = describeError(e);
    }
  }

  private async exportCsv(): Promise<void> {
    if (!this.run || !isApi()) return;
    try {
      const blob = await fetchCsv(this.run.id);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `arx-station-acceptance-${this.run.id.slice(-8)}.csv`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      this.note = describeError(e);
    }
  }

  private print(): void {
    const r = this.run;
    if (!r) return;
    const rows: string[][] = [];
    const add = (run: ValidationRun) =>
      run.stations.forEach((s) => s.checks.forEach((c) => rows.push([s.name || s.station_id, c.label, c.status_text, c.reason_text ?? '', detailLine(c)])));
    add(r);
    r.pulses.forEach(add);
    const ok = printHtml(
      printDocument({
        title: 'בדיקת קבלה לעמדות',
        subtitle: `${formatTime(r.created_at, 'he-IL', UTC_ZONE)} (UTC) · ${r.created_by_name ?? ''} · ${RUN_STATE_TEXT[r.state] ?? r.state} · ${r.station_count} עמדות`,
        columns: ['עמדה', 'בדיקה', 'תוצאה', 'סיבה', 'פרטים'],
        rows,
        footer: `SmplWise Arx · הודפס ${formatTime(new Date().toISOString(), 'he-IL', UTC_ZONE)} (UTC) · ${r.id}`,
        lang: 'he',
      }),
    );
    if (!ok) this.note = 'הדפדפן לא פתח את חלון ההדפסה.';
  }

  // ---------------------------------------------------------------- the pulse (physical)

  private openPulse(s: ValidationStation): void {
    this.pulseError = '';
    this.pulse = { station: s, door: s.doors[0]?.door ?? 1, witness: '', typed: '' };
  }

  private async sendPulse(): Promise<void> {
    const p = this.pulse;
    if (!p || this.busy || !confirmMatches(p.station, p.typed) || p.witness.trim().length < 2) return;
    this.busy = true;
    this.pulseError = '';
    try {
      const parent = this.run && this.run.kind === 'checks' && this.run.stations.some((x) => x.station_id === p.station.id) ? this.run.id : null;
      await sendPulse({ station_id: p.station.id, door: p.door, confirm_text: p.typed, witness_name: p.witness.trim(), parent_run_id: parent });
      this.pulse = null;
      if (parent) await this.openRun(parent);
      this.note = 'הפקודה נשלחה. רשמו את מה שהעד ראה.';
    } catch (e) {
      this.pulseError = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async witness(runId: string, verdict: WitnessVerdict): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await sendWitness(runId, verdict);
      if (this.run) await this.openRun(this.run.id);
    } catch (e) {
      this.note = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- render

  render() {
    const d = this.data;
    const running = !!this.run && !runFinished(this.run);
    return html`<sw-page heading="בדיקת קבלה לעמדות" subheading="בדיקה לכל עמדה: זהות, דלתות, תמונה, דיבור, אירועים ושעון. הבדיקות קוראות בלבד ורצות רק כשלוחצים." data-lv-page>
      <span slot="actions" class="acts">
        <a class="back" href="#/system/diagnostics?tab=access-control" data-lv-back>מצב WisKey</a>
        ${d && d.stations.length
          ? html`<sw-button variant="primary" icon="play" ?disabled=${!isApi() || running || this.busy} data-lv-run-all @click=${() => void this.start({ all: true })}>בדוק את כל העמדות</sw-button>`
          : nothing}
      </span>
      ${this.forbidden
        ? html`<sw-state-panel state="forbidden" data-lv-state="forbidden" heading="אין הרשאה למסך הזה" hint="בדיקת הקבלה פתוחה למי שמנהל עמדות (ניהול עמדות)."></sw-state-panel>`
        : this.error
          ? html`<sw-state-panel state="error" data-lv-state="error" heading="בדיקת הקבלה לא נטענה" hint=${this.error} actionLabel="ניסיון חוזר" @action=${() => void this.load()}></sw-state-panel>`
          : !d
            ? html`<sw-state-panel state="loading" data-lv-state="loading" heading="טוען את העמדות…"></sw-state-panel>`
            : !d.stations.length
              ? html`<sw-state-panel state="empty" data-lv-state="empty" heading="אין עמדות לבדיקה" hint=${d.feed_state === 'ready' ? 'לא נמצאו עמדות שמותר לך לבדוק.' : 'נתוני העמדות מ-WisKey אינם זמינים כרגע.'}></sw-state-panel>`
              : html`<div class="wrap" data-lv-state="ready">
                  ${this.note ? html`<p class="note" role="status" data-lv-note>${this.note}</p>` : nothing}
                  ${this.runBar(d)}
                  <div class="grid">${repeat(this.order(d), (s) => s.id, (s) => this.stationCard(d, s))}</div>
                  <p class="muted foot">"לא נתמך ב-WisKey" = הגרסה המותקנת של WisKey אינה מציעה את הבדיקה. "לא הורץ" = הבדיקה לא נוסתה (הגדרה כבויה, אין שיוך דלתות, בוטל). תוצאה לא ידועה מ-WisKey נרשמת ככישלון, לעולם לא כהצלחה.</p>
                </div>`}
      ${this.pulseDialog()}
    </sw-page>`;
  }

  private order(d: ValidationOverview): ValidationStation[] {
    if (!this.focusStation) return d.stations;
    const first = d.stations.filter((s) => s.id === this.focusStation);
    return [...first, ...d.stations.filter((s) => s.id !== this.focusStation)];
  }

  private runBar(d: ValidationOverview): TemplateResult {
    const r = this.run;
    const running = !!r && !runFinished(r);
    const pct = r && r.progress.total ? Math.round((r.progress.done / r.progress.total) * 100) : 0;
    return html`<div class="bar" data-lv-bar>
      ${d.runs.length
        ? html`<sw-field label="בדיקה"><select data-lv-history @change=${(e: Event) => void this.openRun((e.target as HTMLSelectElement).value)}>
            ${d.runs.map((x) => html`<option value=${x.id} ?selected=${r?.id === x.id}>${formatTime(x.created_at, 'he-IL', UTC_ZONE)} · ${x.scope === 'all' ? 'כל העמדות' : 'עמדה אחת'} · ${RUN_STATE_TEXT[x.state] ?? x.state}</option>`)}
          </select></sw-field>`
        : html`<span class="muted" data-lv-no-runs>עוד לא הורצה בדיקה. בחרו עמדה או "בדוק את כל העמדות".</span>`}
      ${r
        ? html`<div class="prog" data-lv-progress=${r.state}>
              <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax=${r.progress.total} aria-valuenow=${r.progress.done} aria-label="התקדמות הבדיקה"><span style="inline-size:${pct}%"></span></div>
              <span class="muted">${RUN_STATE_TEXT[r.state] ?? r.state} · ${r.progress.done}/${r.progress.total} · עבר ${r.counts.pass} · נכשל ${r.counts.fail} · לא נתמך ${r.counts.unsupported} · לא הורץ ${r.counts.not_run}</span>
            </div>
            <div class="tools">
              ${running && !r.cancel_requested ? html`<sw-button size="sm" icon="stopSquare" data-lv-cancel @click=${() => void this.cancel()}>עצור</sw-button>` : nothing}
              <sw-button size="sm" icon="download" ?disabled=${running || !isApi()} data-lv-export @click=${() => void this.exportCsv()}>CSV</sw-button>
              <sw-button size="sm" icon="list" ?disabled=${running} data-lv-print @click=${() => this.print()}>הדפסה / PDF</sw-button>
            </div>`
        : nothing}
    </div>`;
  }

  private resultsOf(stationId: string): { checks: CheckResult[] | null; pulses: Array<{ runId: string; c: CheckResult }> } {
    const r = this.run;
    const st = r?.stations.find((s) => s.station_id === stationId);
    const pulses = (r?.pulses ?? []).flatMap((p) => p.stations.filter((s) => s.station_id === stationId).flatMap((s) => s.checks.map((c) => ({ runId: p.id, c }))));
    return { checks: st ? st.checks : null, pulses };
  }

  private stationCard(d: ValidationOverview, s: ValidationStation): TemplateResult {
    const { checks, pulses } = this.resultsOf(s.id);
    const running = !!this.run && !runFinished(this.run);
    const focus = this.focusStation === s.id;
    return html`<section class="st ${focus ? 'focus' : ''}" data-lv-station=${s.id}>
      <header>
        <div class="name"><b>${s.name || s.id}</b><sw-badge kind=${s.online ? 'live' : 'offline'} label=${s.online ? 'מחוברת' : 'מנותקת'}></sw-badge></div>
        <sw-button size="sm" icon="play" ?disabled=${!isApi() || running || this.busy} data-lv-run-one=${s.id} @click=${() => void this.start({ station_id: s.id })}>בדוק</sw-button>
      </header>
      ${checks
        ? html`<ul class="checks">${checks.map((c) => this.checkRow(c))}</ul>`
        : html`<p class="muted" data-lv-not-checked>${this.run ? 'העמדה לא נבדקה בבדיקה הזו.' : 'העמדה עוד לא נבדקה.'}</p>`}
      ${this.pulseBlock(d, s, pulses, running)}
    </section>`;
  }

  private checkRow(c: CheckResult): TemplateResult {
    const extra = detailLine(c);
    return html`<li data-lv-check=${c.check} data-status=${c.status}>
      <sw-badge kind=${statusKind(c.status)} label=${c.status_text}></sw-badge>
      <div class="ctext"><span class="clabel">${c.label}</span>${c.reason_text ? html`<span class="reason" data-lv-reason=${c.reason ?? ''}>${c.reason_text}</span>` : nothing}${extra ? html`<span class="muted detail">${extra}</span>` : nothing}</div>
    </li>`;
  }

  private pulseBlock(d: ValidationOverview, s: ValidationStation, pulses: Array<{ runId: string; c: CheckResult }>, running: boolean): TemplateResult | typeof nothing {
    if (!d.rights.pulse) return nothing;
    const done = pulses[0];
    if (done) {
      const awaiting = done.c.status === 'pending' && done.c.reason === 'awaiting_witness';
      return html`<div class="pulse" data-lv-pulse-result=${done.c.status}>
        <div class="phead"><sw-badge kind=${awaiting ? 'stale' : statusKind(done.c.status)} label=${awaiting ? 'ממתין לעד' : done.c.status_text}></sw-badge><span class="clabel">${done.c.label}</span></div>
        ${done.c.reason_text ? html`<div class="reason">${done.c.reason_text}</div>` : nothing}
        ${detailLine(done.c) ? html`<div class="muted detail">${detailLine(done.c)}</div>` : nothing}
        ${awaiting
          ? html`<div class="verdicts" data-lv-witness>${(['opened', 'not_opened', 'unsure'] as WitnessVerdict[]).map(
              (v) => html`<sw-button size="sm" variant=${v === 'opened' ? 'primary' : 'secondary'} ?disabled=${this.busy} data-lv-verdict=${v} @click=${() => void this.witness(done.runId, v)}>${WITNESS_TEXT[v]}</sw-button>`,
            )}</div>`
          : nothing}
      </div>`;
    }
    if (!d.rights.pulse_local) return html`<p class="muted" data-lv-pulse-remote>פתיחת דלת עם עד אפשרית רק מחיבור מקומי.</p>`;
    if (!s.can_pulse) return html`<p class="muted" data-lv-pulse-off>${s.doors.length ? 'אין לך הרשאה לפתוח דלתות בעמדה הזו.' : 'פתיחת דלת עם עד: אין לעמדה דלת משויכת.'}</p>`;
    return html`<div class="pulse idle">
      <sw-button size="sm" variant="danger" icon="doorOpen" ?disabled=${!isApi() || running || this.busy} data-lv-pulse-open=${s.id} @click=${() => this.openPulse(s)}>${PHYSICAL}</sw-button>
      <span class="muted">פעם אחת לעמדה, עם עד ליד הדלת. לא חלק מ"בדוק את כל העמדות".</span>
    </div>`;
  }

  private pulseDialog(): TemplateResult {
    const p = this.pulse;
    const ok = !!p && confirmMatches(p.station, p.typed) && p.witness.trim().length >= 2;
    return html`<sw-dialog ?open=${!!p} heading=${PHYSICAL} subheading=${p ? p.station.name || p.station.id : ''} ?locked=${this.busy} @close=${() => (this.pulse = null)} data-lv-pulse-dialog>
      ${p
        ? html`<div class="dlg">
            <p class="warn" role="alert" data-lv-physical>לחיצה על "פתח את הדלת" שולחת לעמדה פקודת פתיחה אחת. <b>הדלת תיפתח באמת.</b> ודאו שהעד עומד ליד הדלת ושאין סכנה לאיש. הפקודה לא נשלחת שוב אוטומטית.</p>
            ${p.station.doors.length > 1
              ? html`<sw-field label="דלת"><select data-lv-door @change=${(e: Event) => (this.pulse = { ...p, door: Number((e.target as HTMLSelectElement).value) })}>
                  ${p.station.doors.map((x) => html`<option value=${x.door} ?selected=${x.door === p.door}>${x.name ? `${x.name} (${x.door})` : `דלת ${x.door}`}</option>`)}
                </select></sw-field>`
              : html`<p class="muted">דלת: ${p.station.doors[0]?.name ?? `דלת ${p.door}`}</p>`}
            <sw-field label="שם העד" hint="מי שעומד ליד הדלת ומאשר מה ראה."><input data-lv-witness-name maxlength="80" autocomplete="off" .value=${p.witness} @input=${(e: Event) => (this.pulse = { ...p, witness: (e.target as HTMLInputElement).value })} /></sw-field>
            <sw-field label=${`להמשך הקלידו את שם העמדה: ${p.station.name || p.station.id}`}><input data-lv-confirm autocomplete="off" .value=${p.typed} @input=${(e: Event) => (this.pulse = { ...p, typed: (e.target as HTMLInputElement).value })} /></sw-field>
            ${this.pulseError ? html`<p class="err" role="alert" data-lv-pulse-error>${this.pulseError}</p>` : nothing}
            <div class="dacts">
              <sw-button ?disabled=${this.busy} @click=${() => (this.pulse = null)}>ביטול</sw-button>
              <sw-button variant="danger" icon="doorOpen" ?disabled=${!ok || this.busy} data-lv-pulse-send @click=${() => void this.sendPulse()}>${this.busy ? 'שולח…' : 'פתח את הדלת'}</sw-button>
            </div>
          </div>`
        : nothing}
    </sw-dialog>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .back {
      color: var(--sw-accent);
      font-size: var(--sw-fs-sm);
      text-decoration: none;
      padding: 6px 4px;
    }
    .back:hover {
      text-decoration: underline;
    }
    .wrap {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4, 16px);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .note {
      margin: 0;
      padding: 8px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 10px 16px;
      padding: 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .bar sw-field {
      min-inline-size: min(320px, 100%);
    }
    .prog {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1 1 260px;
      min-inline-size: 0;
    }
    .track {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-2);
      overflow: hidden;
    }
    .track span {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
      gap: 12px;
    }
    .st {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      min-inline-size: 0;
    }
    .st.focus {
      border-color: var(--sw-accent);
    }
    .st header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .name {
      display: flex;
      align-items: center;
      gap: 8px;
      min-inline-size: 0;
    }
    .name b {
      overflow-wrap: anywhere;
    }
    .checks {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    .checks li {
      display: grid;
      grid-template-columns: 140px 1fr;
      align-items: start;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .checks li:last-child {
      border-block-end: 0;
    }
    .ctext {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .clabel {
      font-weight: var(--sw-fw-medium);
    }
    .reason {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      overflow-wrap: anywhere;
    }
    .detail {
      overflow-wrap: anywhere;
    }
    .pulse {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      border: 1px dashed var(--sw-danger, #c62828);
      border-radius: var(--sw-r-sm);
    }
    .pulse.idle {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
    .phead {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .verdicts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .dlg {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .warn {
      margin: 0;
      padding: 10px 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-danger, #c62828);
      color: var(--sw-text);
      background: color-mix(in srgb, var(--sw-danger, #c62828) 10%, transparent);
    }
    .err {
      margin: 0;
      color: var(--sw-danger, #c62828);
      font-size: var(--sw-fs-sm);
    }
    .dacts {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
    }
    .foot {
      margin: 0;
    }
    @media (max-width: 600px) {
      .checks li {
        grid-template-columns: 140px 1fr;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'system-wiskey-validation': SystemWiskeyValidation;
  }
}
