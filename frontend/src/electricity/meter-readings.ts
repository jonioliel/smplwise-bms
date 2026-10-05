import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-button';
import { ApiError, describeError } from '../api/client';
import {
  addCalibration,
  addManualReading,
  EFFECT_LABEL,
  isoToLocalInput,
  localInputToIso,
  parseFactor,
  parseReading,
  undoCalibration,
  undoManualReading,
  type Calibration,
  type ManualReading,
  type ReadingLog,
  type ReadingUnit,
} from '../api/electricity-readings';
import { fmtDate, fmtDateTime, fmtReading, fmtSigned } from './format';
import { elecCss } from './styles';
import { SkinController } from '../design/skin';

export type ReadingsDialog = '' | 'reading' | 'calibrate' | 'undo-reading' | 'undo-calibration';
export interface OpenDialogDetail {
  kind: Exclude<ReadingsDialog, ''>;
  id?: string;
  /** calibrate from the suggestion: its factor and anchor reading */
  factor?: string;
  anchor?: string;
}

const UNITS: { id: ReadingUnit; label: string }[] = [
  { id: 'kWh', label: 'קוט״ש' },
  { id: 'Wh', label: 'וואט־שעה' },
  { id: 'MWh', label: 'מגוואט־שעה' },
];

const sectionCss = css`
  .rd {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h3 {
    margin: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
  }
  h4 {
    margin: 4px 0 0;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  .li {
    flex-wrap: wrap;
  }
  .li.dis .t1 .num {
    text-decoration: line-through;
  }
  .acts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cal {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .sug {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
`;

/**
 * EL6, in the meter card: the calibration in force, a suggested factor, the manual readings and the calibrations (undone ones stay, marked).
 * A holder of energy.manage gets "קריאה ידנית", "כיול" and the undo of a fresh item; the dialogs live outside the drawer
 * (`elec-reading-dialogs`), so this section only fires `open-dialog`.
 */
@customElement('elec-meter-readings')
export class ElecMeterReadings extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) log: ReadingLog | null = null;
  @property({ type: Boolean }) canManage = false;
  @property() error = '';

  static styles = [elecCss, sectionCss];

  private open(detail: OpenDialogDetail) {
    this.dispatchEvent(new CustomEvent<OpenDialogDetail>('open-dialog', { detail }));
  }

  private calLine(l: ReadingLog) {
    const c = l.calibration;
    if (c.identity) return html`<div class="cal" data-calibration="none">ללא כיול: הקריאות כפי שהמונה מדווח</div>`;
    return html`<div class="cal" data-calibration=${c.calibration_id ?? ''}>כיול מ-<span class="num">${fmtDate(c.effective_date)}</span> · מקדם <span class="num">${c.factor}</span>
      · הפרש <span class="num ltr">${fmtSigned(c.offset_kwh)}</span> קוט״ש</div>`;
  }

  private reading(r: ManualReading) {
    const dev = r.deviation_kwh == null ? 'אין ערך מערכת לזמן הזה' : html`מהמערכת <span class="num ltr">${fmtSigned(r.deviation_kwh)}</span>`;
    return html`<div class="li ${r.voided_at ? 'dis' : ''}" data-reading=${r.id ?? ''}>
      <div class="grow">
        <div class="t1"><span class="num">${fmtReading(r.value_kwh)}</span> קוט״ש · <span class="num">${fmtDateTime(r.read_at)}</span></div>
        <div class="t2 wrap">${dev}${r.created_by_name ? ` · ${r.created_by_name}` : ''}${r.note ? ` · ${r.note}` : ''}${r.voided_at ? html` · <b>בוטלה</b>${r.voided_by_name ? ` (${r.voided_by_name})` : ''}` : ''}</div>
      </div>
      <span class="chip nodot ${r.effect === 'allocation' ? 'c-acc' : 'c-mut'}" data-effect=${r.effect_reason} title=${r.message}>${EFFECT_LABEL[r.effect_reason]}</span>
      ${this.canManage && r.can_undo && r.id ? html`<sw-button size="sm" variant="ghost" data-reading-undo=${r.id} @click=${() => this.open({ kind: 'undo-reading', id: r.id! })}>ביטול</sw-button>` : nothing}
    </div>`;
  }

  private calibration(c: Calibration) {
    return html`<div class="li ${c.voided_at ? 'dis' : ''}" data-cal=${c.id ?? ''}>
      <div class="grow">
        <div class="t1">מ-<span class="num">${fmtDate(c.effective_date)}</span> · מקדם <span class="num">${c.factor}</span> · הפרש <span class="num ltr">${fmtSigned(c.offset_kwh)}</span></div>
        <div class="t2 wrap">${c.created_by_name ?? ''}${c.note ? ` · ${c.note}` : ''}${c.voided_at ? html` · <b>בוטל</b>` : ''}</div>
      </div>
      ${c.in_force ? html`<span class="chip nodot c-acc">בתוקף</span>` : nothing}
      ${this.canManage && c.can_undo && c.id ? html`<sw-button size="sm" variant="ghost" data-cal-undo=${c.id} @click=${() => this.open({ kind: 'undo-calibration', id: c.id! })}>ביטול</sw-button>` : nothing}
    </div>`;
  }

  render() {
    const l = this.log;
    return html`<div class="rd" data-readings>
      <div class="row"><h3>קריאות ידניות וכיול</h3><span class="sp"></span>
        ${this.canManage && l
          ? html`<div class="acts"><sw-button size="sm" data-reading-add @click=${() => this.open({ kind: 'reading' })}>קריאה ידנית</sw-button>
              <sw-button size="sm" data-calibrate @click=${() => this.open({ kind: 'calibrate' })}>כיול</sw-button></div>`
          : nothing}</div>
      ${this.error ? html`<div class="alert err" role="alert" data-readings-error>${this.error}</div>` : nothing}
      ${l
        ? html`${this.calLine(l)}
            ${this.canManage && l.suggestion
              ? html`<div class="alert info sug" data-suggestion><div>לפי שתי קריאות ההשוואה: מקדם <span class="num">${l.suggestion.factor}</span></div><span class="sp"></span>
                  <sw-button size="sm" data-suggestion-apply @click=${() => this.open({ kind: 'calibrate', factor: l.suggestion!.factor, anchor: l.suggestion!.anchor_reading_id })}>כיול לפי ההצעה</sw-button></div>`
              : nothing}
            ${l.items.length ? html`<div class="list" data-reading-list>${l.items.map((r) => this.reading(r))}</div>` : html`<div class="mut" data-reading-empty>אין קריאות ידניות</div>`}
            ${l.calibrations.length ? html`<h4>כיולים</h4><div class="list" data-cal-list>${l.calibrations.map((c) => this.calibration(c))}</div>` : nothing}`
        : this.error
          ? nothing
          : html`<div class="skl" style="inline-size:60%"></div>`}
    </div>`;
  }
}

/**
 * The EL6 dialogs of the meter card: a manual reading (with a live preview of what it will do), a calibration (from a compared reading or a
 * typed difference) and the undo confirmations. Fires `close` and `saved` (detail: the fresh log).
 */
@customElement('elec-reading-dialogs')
export class ElecReadingDialogs extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() meterId = '';
  @property({ attribute: false }) log: ReadingLog | null = null;
  @property() kind: ReadingsDialog = '';
  @property() targetId = '';
  @property() presetFactor = '';
  @property() presetAnchor = '';

  @state() private when = '';
  @state() private value = '';
  @state() private unit: ReadingUnit = 'kWh';
  @state() private note = '';
  @state() private preview: ManualReading | Calibration | null = null;
  @state() private previewError = '';
  @state() private error = '';
  @state() private fieldErrors: Record<string, string> = {};
  @state() private busy = false;
  @state() private date = '';
  @state() private mode: 'anchor' | 'offset' = 'anchor';
  @state() private anchor = '';
  @state() private factor = '1';
  @state() private offset = '0';
  @state() private reason = '';
  private timer = 0;
  private seq = 0;

  static styles = [
    elecCss,
    sectionCss,
    css`
      :host {
        display: contents;
      }
      .pv {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        font-size: var(--sw-fs-sm);
      }
      dl.kv {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px 14px;
        margin: 0;
      }
      dl.kv dt {
        color: var(--sw-text-3);
      }
      dl.kv dd {
        margin: 0;
      }
      .form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .form .wide {
        grid-column: 1 / -1;
      }
      .hint {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-3);
      }
      @media (max-width: 520px) {
        .form {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('kind') && this.kind) this.reset();
  }

  disconnectedCallback() {
    window.clearTimeout(this.timer);
    super.disconnectedCallback();
  }

  private reset() {
    this.preview = null;
    this.previewError = '';
    this.error = '';
    this.fieldErrors = {};
    this.busy = false;
    this.reason = '';
    this.note = '';
    if (this.kind === 'reading') {
      this.when = isoToLocalInput(new Date());
      this.value = '';
      this.unit = 'kWh';
    }
    if (this.kind === 'calibrate') {
      const today = isoToLocalInput(new Date()).slice(0, 10);
      const first = this.log?.first_calibration_date ?? '';
      this.date = first && first > today ? first : today;
      this.factor = this.presetFactor || '1';
      const anchors = this.anchors();
      this.anchor = this.presetAnchor || anchors[0]?.id || '';
      this.mode = anchors.length ? 'anchor' : 'offset';
      this.offset = '0';
      this.schedule();
    }
  }

  private anchors(): ManualReading[] {
    return (this.log?.items ?? []).filter((r) => !r.voided_at && r.id && (r.system_kwh != null || r.effect === 'allocation'));
  }

  private close() {
    window.clearTimeout(this.timer);
    this.dispatchEvent(new CustomEvent('close')); // not bubbling: the card's own close would shut the drawer
  }

  private saved(log: ReadingLog) {
    this.dispatchEvent(new CustomEvent<ReadingLog>('saved', { detail: log }));
  }

  /** The reading body, or null with the field messages set. */
  private readingBody(dry: boolean) {
    const errs: Record<string, string> = {};
    const iso = localInputToIso(this.when);
    if (!iso) errs.when = 'צריך לבחור תאריך ושעה';
    else if (Date.parse(iso) > Date.now() + 300_000) errs.when = 'זמן הקריאה בעתיד';
    const v = parseReading(this.value);
    if (v == null) errs.value = 'צריך להזין מספר תקין';
    if (!dry) this.fieldErrors = errs;
    if (Object.keys(errs).length || !iso || v == null) return null;
    return { read_at: iso, value: v, unit: this.unit, ...(this.note.trim() ? { note: this.note.trim() } : {}), dry_run: dry };
  }

  private calibrationBody(dry: boolean) {
    const errs: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.date)) errs.date = 'צריך לבחור תאריך';
    const f = parseFactor(this.factor);
    if (f == null) errs.factor = 'מקדם בין 0.5 ל-2';
    let off: string | null = '0';
    if (this.mode === 'offset') {
      const t = this.offset.trim().replace(',', '.');
      off = /^[-−]?\d+(\.\d+)?$/.test(t) ? t.replace('−', '-') : null;
      if (off == null) errs.offset = 'צריך להזין מספר תקין';
    } else if (!this.anchor) errs.anchor = 'צריך לבחור קריאה';
    if (!dry) this.fieldErrors = errs;
    if (Object.keys(errs).length || f == null) return null;
    return {
      effective_date: this.date,
      factor: f,
      ...(this.mode === 'anchor' ? { anchor_reading_id: this.anchor } : { offset_kwh: off ?? '0' }),
      ...(this.note.trim() ? { note: this.note.trim() } : {}),
      dry_run: dry,
    };
  }

  /** A dry run a moment after the last keystroke: what the server says the item will do. */
  private schedule() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.runPreview(), 350);
  }

  private async runPreview() {
    const my = ++this.seq;
    try {
      if (this.kind === 'reading') {
        const body = this.readingBody(true);
        if (!body) return void ((this.preview = null), (this.previewError = ''));
        const r = await addManualReading(this.meterId, body);
        if (my === this.seq) ((this.preview = r.reading), (this.previewError = ''));
      } else if (this.kind === 'calibrate') {
        const body = this.calibrationBody(true);
        if (!body) return void ((this.preview = null), (this.previewError = ''));
        const r = await addCalibration(this.meterId, body);
        if (my === this.seq) ((this.preview = r.calibration), (this.previewError = ''));
      }
    } catch (err) {
      if (my === this.seq) ((this.preview = null), (this.previewError = describeError(err)));
    }
  }

  private async save() {
    if (this.busy) return;
    const body = this.kind === 'reading' ? this.readingBody(false) : this.calibrationBody(false);
    if (!body) return;
    this.busy = true;
    this.error = '';
    try {
      const r = this.kind === 'reading' ? await addManualReading(this.meterId, body as never) : await addCalibration(this.meterId, body as never);
      if (r.log) this.saved(r.log);
      this.close();
    } catch (err) {
      this.error = describeError(err);
      const fields = err instanceof ApiError ? ((err.body.details as { fields?: string[] } | undefined)?.fields ?? []) : [];
      if (fields.length) this.fieldErrors = Object.fromEntries(fields.map((f) => [f === 'read_at' ? 'when' : f === 'effective_date' ? 'date' : f === 'offset_kwh' ? 'offset' : f === 'anchor_reading_id' ? 'anchor' : f, ' ']));
    } finally {
      this.busy = false;
    }
  }

  private async undo() {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const log = this.kind === 'undo-reading' ? await undoManualReading(this.meterId, this.targetId, this.reason.trim() || undefined) : await undoCalibration(this.meterId, this.targetId, this.reason.trim() || undefined);
      this.saved(log);
      this.close();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private fieldMsg(key: string) {
    const m = this.fieldErrors[key];
    return m && m.trim() ? html`<div class="msg" role="alert" data-field-error=${key}>${m}</div>` : nothing;
  }

  private readingPreview() {
    const p = this.preview as ManualReading | null;
    if (this.previewError) return html`<div class="alert warn" role="status" data-reading-preview="error">${this.previewError}</div>`;
    if (!p) return nothing;
    return html`<div class="pv" data-reading-preview=${p.effect_reason}>
      <dl class="kv">
        <dt>המערכת באותו זמן</dt><dd>${p.system_kwh == null ? 'אין ערך' : html`<span class="num">${fmtReading(p.system_kwh)}</span> קוט״ש`}</dd>
        ${p.deviation_kwh == null ? nothing : html`<dt>הפרש</dt><dd><span class="num ltr">${fmtSigned(p.deviation_kwh)}</span> קוט״ש</dd>`}
      </dl>
      <div data-preview-message>${p.message}</div>
    </div>`;
  }

  private renderReading() {
    const set = (k: 'when' | 'value' | 'note', v: string) => {
      this[k] = v;
      if (k !== 'note') {
        this.fieldErrors = { ...this.fieldErrors, [k]: '' };
        this.schedule();
      }
    };
    return html`<sw-dialog open heading="קריאה ידנית" data-reading-dialog @close=${(e: Event) => { e.stopPropagation(); this.close(); }}>
      <div class="form">
        <div class="fld"><label for="rw">תאריך ושעה</label>
          <div class="inp ${this.fieldErrors.when ? 'err' : ''}"><input id="rw" type="datetime-local" data-reading-when max=${isoToLocalInput(new Date())} .value=${this.when} @input=${(e: Event) => set('when', (e.target as HTMLInputElement).value)} /></div>
          ${this.fieldMsg('when')}</div>
        <div class="fld"><label for="rv">קריאת המונה</label>
          <div class="inp ${this.fieldErrors.value ? 'err' : ''}"><input id="rv" data-reading-value inputmode="decimal" autocomplete="off" dir="ltr" .value=${this.value} @input=${(e: Event) => set('value', (e.target as HTMLInputElement).value)} />
            <select data-reading-unit aria-label="יחידה" @change=${(e: Event) => { this.unit = (e.target as HTMLSelectElement).value as ReadingUnit; this.schedule(); }}>
              ${UNITS.map((u) => html`<option value=${u.id} ?selected=${u.id === this.unit}>${u.label}</option>`)}</select></div>
          ${this.fieldMsg('value')}</div>
        <div class="fld wide"><label for="rn">הערה (לא חובה)</label><div class="inp"><input id="rn" data-reading-note maxlength="500" .value=${this.note} @input=${(e: Event) => set('note', (e.target as HTMLInputElement).value)} /></div></div>
        <div class="wide">${this.readingPreview()}</div>
        ${this.error ? html`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>` : nothing}
      </div>
      <sw-button slot="footer" variant="primary" data-reading-save ?disabled=${this.busy} @click=${() => void this.save()}>שמירה</sw-button>
      <sw-button slot="footer" @click=${() => this.close()}>ביטול</sw-button>
    </sw-dialog>`;
  }

  private renderCalibrate() {
    const anchors = this.anchors();
    const p = this.preview as Calibration | null;
    const first = this.log?.first_calibration_date ?? '';
    const set = (k: 'date' | 'factor' | 'offset' | 'anchor', v: string) => {
      this[k] = v;
      this.fieldErrors = { ...this.fieldErrors, [k]: '' };
      this.schedule();
    };
    return html`<sw-dialog open heading="כיול מונה" data-calibrate-dialog @close=${(e: Event) => { e.stopPropagation(); this.close(); }}>
      <div class="form">
        <div class="hint wide">מהתאריך: קריאה פיזית = מקדם × מונה המערכת + הפרש. חיובים שהופקו לא משתנים.</div>
        <div class="fld"><label for="cd">בתוקף מ-</label>
          <div class="inp ${this.fieldErrors.date ? 'err' : ''}"><input id="cd" type="date" data-cal-date min=${first} .value=${this.date} @input=${(e: Event) => set('date', (e.target as HTMLInputElement).value)} /></div>
          ${this.fieldMsg('date')}</div>
        <div class="fld"><label for="cf">מקדם</label>
          <div class="inp ${this.fieldErrors.factor ? 'err' : ''}"><input id="cf" data-cal-factor inputmode="decimal" dir="ltr" .value=${this.factor} @input=${(e: Event) => set('factor', (e.target as HTMLInputElement).value)} /></div>
          ${this.fieldMsg('factor')}</div>
        <div class="fld wide"><span class="lbl">הפרש</span>
          <div class="seg" role="group" aria-label="הפרש">
            <button type="button" data-cal-mode="anchor" aria-pressed=${this.mode === 'anchor' ? 'true' : 'false'} ?disabled=${!anchors.length} @click=${() => { this.mode = 'anchor'; this.schedule(); }}>לפי קריאה ידנית</button>
            <button type="button" data-cal-mode="offset" aria-pressed=${this.mode === 'offset' ? 'true' : 'false'} @click=${() => { this.mode = 'offset'; this.schedule(); }}>הזנה ידנית</button></div></div>
        ${this.mode === 'anchor'
          ? html`<div class="fld wide"><label for="ca">קריאה</label>
              <div class="inp ${this.fieldErrors.anchor ? 'err' : ''}"><select id="ca" data-cal-anchor @change=${(e: Event) => set('anchor', (e.target as HTMLSelectElement).value)}>
                ${anchors.map((r) => html`<option value=${r.id!} ?selected=${r.id === this.anchor}>${fmtDateTime(r.read_at)} · ${fmtReading(r.value_kwh)} קוט״ש</option>`)}</select></div>
              ${this.fieldMsg('anchor')}</div>`
          : html`<div class="fld wide"><label for="co">הפרש (קוט״ש)</label>
              <div class="inp ${this.fieldErrors.offset ? 'err' : ''}"><input id="co" data-cal-offset inputmode="decimal" dir="ltr" .value=${this.offset} @input=${(e: Event) => set('offset', (e.target as HTMLInputElement).value)} /></div>
              ${this.fieldMsg('offset')}</div>`}
        <div class="fld wide"><label for="cn">הערה (לא חובה)</label><div class="inp"><input id="cn" data-cal-note maxlength="500" .value=${this.note} @input=${(e: Event) => (this.note = (e.target as HTMLInputElement).value)} /></div></div>
        ${this.previewError
          ? html`<div class="alert warn wide" role="status" data-cal-preview="error">${this.previewError}</div>`
          : p
            ? html`<div class="pv wide" data-cal-preview><div>מ-<span class="num">${fmtDate(p.effective_date)}</span>: מקדם <span class="num">${p.factor}</span>, הפרש <span class="num ltr">${fmtSigned(p.offset_kwh)}</span> קוט״ש</div></div>`
            : nothing}
        ${this.error ? html`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>` : nothing}
      </div>
      <sw-button slot="footer" variant="primary" data-cal-save ?disabled=${this.busy} @click=${() => void this.save()}>שמירה</sw-button>
      <sw-button slot="footer" @click=${() => this.close()}>ביטול</sw-button>
    </sw-dialog>`;
  }

  private renderUndo() {
    const isReading = this.kind === 'undo-reading';
    const r = isReading ? this.log?.items.find((x) => x.id === this.targetId) : undefined;
    const c = !isReading ? this.log?.calibrations.find((x) => x.id === this.targetId) : undefined;
    const what = r ? html`הקריאה <span class="num">${fmtReading(r.value_kwh)}</span> קוט״ש מ-<span class="num">${fmtDateTime(r.read_at)}</span>` : c ? html`הכיול מ-<span class="num">${fmtDate(c.effective_date)}</span>` : '';
    return html`<sw-dialog open heading=${isReading ? 'ביטול קריאה ידנית' : 'ביטול כיול'} data-undo-dialog @close=${(e: Event) => { e.stopPropagation(); this.close(); }}>
      <div class="form">
        <div class="wide">${what} תבוטל ותישאר ברשימה כמבוטלת.</div>
        <div class="fld wide"><label for="ur">סיבה (לא חובה)</label><div class="inp"><input id="ur" data-undo-reason maxlength="300" .value=${this.reason} @input=${(e: Event) => (this.reason = (e.target as HTMLInputElement).value)} /></div></div>
        ${this.error ? html`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>` : nothing}
      </div>
      <sw-button slot="footer" variant="danger" data-undo-confirm ?disabled=${this.busy} @click=${() => void this.undo()}>ביטול ${isReading ? 'הקריאה' : 'הכיול'}</sw-button>
      <sw-button slot="footer" @click=${() => this.close()}>חזרה</sw-button>
    </sw-dialog>`;
  }

  render() {
    if (this.kind === 'reading') return this.renderReading();
    if (this.kind === 'calibrate') return this.renderCalibrate();
    if (this.kind === 'undo-reading' || this.kind === 'undo-calibration') return this.renderUndo();
    return nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-meter-readings': ElecMeterReadings;
    'elec-reading-dialogs': ElecReadingDialogs;
  }
}
