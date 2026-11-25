/**
 * CR-023 §11/§12 (mockup "חיוב"): one bill - the A4 preview in every state (draft with a watermark, issued, sent, paid, cancelled with
 * a watermark and the reason, a corrected revision, a PDF failure with "create the PDF again" - from the last request or from the bill's
 * `pdf.state` failed / unavailable), the actions the server allows
 * (`bill.actions`) and their confirmation dialogs: issue, cancel with a mandatory reason, correct, mark sent, mark paid, delete a
 * draft. Any holder of the bills permission may issue and cancel (owner decision 5). The PDF itself is produced by the server; this
 * page only links to it.
 */
import { html, nothing } from 'lit';
import '../components/sw-button';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import { customElement, property, state } from 'lit/decorators.js';
import { ERROR_TEXT, PDF_RETRYABLE, elec, elecErrorCode, elecErrorText, elecToday, type Bill, type BillAction, type BillEvent, type BillSnapshot, type SentHow, type SnapshotMeter } from '../api/electricity-billing';
import { energyAccess } from './access';
import { ElecBase, alertBox, billChip, n, skeleton, stateBox, type LoadState } from './elec-ui';
import './elec-bill-paper';
import { baseNumber, f2, fmtDate, ilsOr, fmtDateTime, fmtRange, isIsoDate, openingSource, readingText } from './elec-format';
import { addManualReading, parseReading } from '../api/electricity-readings';
import { go, href, route } from './elec-routes';
import { dateInputLang } from '../api/day-format';
import { tr } from '../i18n/msg/electricity';
import { touName } from './elec-tou';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';

type Tou = NonNullable<BillSnapshot['tou']>;

type Dlg = '' | 'issue' | 'void' | 'correct' | 'sent' | 'paid' | 'delete' | 'opening';
const HOW: Record<SentHow, string> = { email: tr('דוא״ל'), hand: tr('מסירה ידנית'), other: tr('אחר') };

@customElement('elec-bill-page')
export class ElecBillPage extends ElecBase {
  @property() billId = '';
  @state() private st: LoadState = 'loading';
  @state() private bill: Bill | null = null;
  @state() private events: BillEvent[] = [];
  @state() private dlg: Dlg = '';
  @state() private busy = false;
  @state() private error = '';
  /** the last PDF request of this page failed: the code and the text */
  @state() private pdfFail: { code: string; text: string } | null = null;
  @state() private reason = '';
  @state() private reasonTouched = false;
  @state() private date = '';
  @state() private how: SentHow = 'email';
  @state() private text = '';
  /** BILL-start-reading: the meter whose opening reading is being typed, and the server's answer when it was kept for comparison only */
  @state() private openingMeter: SnapshotMeter | null = null;
  @state() private openingInfo = '';
  /** EL5: the daily time-of-use table is open */
  @state() private daily = false;
  private loaded = '';

  willUpdate(ch: Map<string, unknown>) {
    if (ch.has('billId') && this.billId && this.loaded !== this.billId) {
      this.loaded = this.billId;
      void this.load();
    }
  }

  private async load() {
    this.st = 'loading';
    this.pdfFail = null;
    try {
      const [b, e] = await Promise.all([elec().getBill(this.billId), elec().billEvents(this.billId).catch(() => [] as BillEvent[])]);
      this.bill = b;
      this.events = e;
      this.st = 'ready';
    } catch (e) {
      this.error = elecErrorText(e);
      this.st = elecErrorCode(e) === 'forbidden' ? 'forbidden' : 'error';
    }
  }
  private async refreshEvents() {
    this.events = await elec().billEvents(this.billId).catch(() => this.events);
  }

  private open(d: Dlg) {
    this.dlg = d;
    this.error = '';
    this.reason = '';
    this.reasonTouched = false;
    this.text = '';
    this.date = elecToday();
    this.how = 'email';
  }
  private close() {
    this.dlg = '';
  }

  /** runs a mutation, shows the server's refusal inside the dialog */
  private async act(run: () => Promise<Bill | void>, after?: (b: Bill | void) => void) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await run();
      if (r) this.bill = r;
      this.close();
      await this.refreshEvents();
      after?.(r);
    } catch (e) {
      this.error = elecErrorText(e);
    } finally {
      this.busy = false;
    }
  }

  private issue() {
    const b = this.bill as Bill;
    void this.act(() => elec().issueBill(b), () => {
      // the first PDF is rendered when the bill is issued: a failure is shown at once, the bill stays issued
      // (CR-FE-PROMISES-2442: pdf() never rejects - a failed render is the PDF note of this page, `pdfFail`)
      void this.pdf('check');
    });
  }
  private async pdf(mode: 'download' | 'view' | 'check') {
    const b = this.bill as Bill;
    this.pdfFail = null;
    try {
      const blob = await elec().fetchPdf(b.id);
      // the server stores the PDF of an issued bill on the first good render: the bill's pdf state moves on (failed -> stored)
      if (b.state !== 'draft' && b.pdf && b.pdf.state !== 'stored') this.bill = await elec().getBill(b.id).catch(() => this.bill);
      if (mode === 'check') return;
      const url = URL.createObjectURL(blob);
      if (mode === 'view') window.open(url, '_blank', 'noopener');
      else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${b.number ?? `draft-${b.id}`}.pdf`;
        a.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      this.pdfFail = { code: elecErrorCode(e), text: elecErrorText(e) };
    }
  }

  private btn(a: BillAction, b: Bill) {
    switch (a) {
      case 'issue': return html`<sw-button variant="primary" data-act="issue" @click=${() => this.open('issue')}>${tr('הנפקה')}</sw-button>`;
      case 'sent': return html`<sw-button variant=${b.state === 'issued' ? 'primary' : 'secondary'} data-act="sent" @click=${() => this.open('sent')}>${tr('סימון כנשלח')}</sw-button>`;
      case 'paid': return html`<sw-button variant=${b.state === 'sent' ? 'primary' : 'secondary'} data-act="paid" @click=${() => this.open('paid')}>${tr('סימון כשולם')}</sw-button>`;
      case 'recalculate': return html`<sw-button data-act="recalculate" ?disabled=${this.busy} @click=${() => void this.act(() => elec().recalcBill(b))}>${tr('חישוב מחדש')}</sw-button>`;
      case 'pdf': return b.state === 'draft'
        ? html`<sw-button data-act="pdf" @click=${() => void this.pdf('view')}>${tr('תצוגת PDF')}</sw-button>`
        : html`<sw-button data-act="pdf" @click=${() => void this.pdf('download')}>${tr('הורדת PDF')}</sw-button>`;
      case 'correct': return html`<sw-button data-act="correct" @click=${() => this.open('correct')}>${tr('תיקון')}</sw-button>`;
      case 'void': return html`<sw-button variant="danger" data-act="void" @click=${() => this.open('void')}>${tr('ביטול')}</sw-button>`;
      case 'delete': return html`<sw-button variant="danger" data-act="delete" @click=${() => this.open('delete')}>${tr('מחיקת טיוטה')}</sw-button>`;
      default: return nothing;
    }
  }

  render() {
    if (!energyAccess().bills) return html`<div class="page" data-elec="bill" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה לחיובים'))}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="bill" data-state="loading">${skeleton(4)}</div>`;
    if (this.st !== 'ready' || !this.bill)
      return html`<div class="page" data-elec="bill" data-state=${this.st}><div class="row"><a class="btn ghost sm" href=${href.bills()}>${tr('→ חיובים')}</a></div>${stateBox(this.st === 'forbidden' ? 'forbidden' : 'error', this.st === 'forbidden' ? 'lock' : 'warning', this.error || tr('לא ניתן לטעון את החיוב'), this.st === 'error' ? { label: tr('נסה שוב'), run: () => void this.load() } : undefined)}</div>`;
    const b = this.bill;
    const s = b.snapshot;
    // i18n-keep: the bill document is issued in Hebrew (the watermark text is compared in elec-bill-paper)
    const wm = b.state === 'draft' ? 'טיוטה' : b.state === 'void' ? 'בוטל' : '';
    const actions = html`${b.actions.map((a) => this.btn(a, b))}`;
    const warnings = b.state === 'draft' ? s.notes.filter((x) => x.code === 'meter_not_reporting' || x.code === 'carried_in') : [];
    const side = html`<div class="card"><div class="hd"><b class="h3">${tr('פרטים')}</b></div><dl class="kv" data-bill-details>
        <dt>${tr('חשבון')}</dt><dd><a class="lnk" href=${href.account(b.account_id)}>${b.account_name}</a></dd><dt>${tr('לקוח')}</dt><dd>${b.customer.name}</dd>
        <dt>${tr('תקופה')}</dt><dd>${n(fmtDate(b.period.from))} - ${n(fmtDate(b.period.to))}</dd>
        ${b.issue_date ? html`<dt>${tr('הונפק')}</dt><dd>${n(fmtDate(b.issue_date))}</dd>` : nothing}${b.due_date ? html`<dt>${tr('לתשלום עד')}</dt><dd>${n(fmtDate(b.due_date))}</dd>` : nothing}
        ${b.sent ? html`<dt>${tr('נשלח')}</dt><dd><span class="num" data-sent-at>${fmtDate(b.sent.at)}</span> · ${HOW[b.sent.how]}</dd>` : nothing}${b.paid ? html`<dt>${tr('שולם')}</dt><dd><span class="num" data-paid-at>${fmtDate(b.paid.at)}</span>${b.paid.reference ? html` · ${n(b.paid.reference)}` : nothing}</dd>` : nothing}
        <dt>${tr('מקור')}</dt><dd>${b.origin === 'auto' ? tr('נוצר אוטומטית') : tr('נוצר ידנית')}</dd></dl></div>
      ${this.openingCard(b)}
      ${this.touCard(s)}
      <div class="card"><div class="hd"><b class="h3">${tr('יומן')}</b></div><div class="list" data-bill-log>${this.events.map((e) => html`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${fmtDateTime(e.at)}</span><span>${e.text}</span></div>`)}</div></div>`;
    return html`<div class="page" data-elec="bill" data-state="ready" data-bill-state=${b.state} data-bill-id=${b.id}>
      <div class="row"><a class="btn ghost sm" href=${href.bills()} data-back>${tr('→ חיובים')}</a></div>
      <div class="row"><b class="h2 num" data-bill-number>${b.number ?? tr('טיוטה')}</b>${billChip(b.state)}
        ${b.replaces_bill_id && s.bill.replaces ? html`<span class="mut">${tr('מחליף את')} <a class="lnk num" href=${href.bill(b.replaces_bill_id)}>${s.bill.replaces.number}</a></span>` : nothing}
        ${b.replaced_by_bill_id ? html`<span class="mut">${tr('הוחלף בחיוב')} <a class="lnk" href=${href.bill(b.replaced_by_bill_id)}>${tr('המתוקן')}</a></span>` : nothing}
        <span class="sp"></span>${this.phone ? nothing : actions}</div>
      ${this.phone ? html`<div class="row" data-actions>${actions}</div>` : nothing}
      ${this.pdfNotice(b)}
      ${b.state === 'void' && b.void ? alertBox('err', html`<b>${tr('בוטל:')}</b> ${b.void.reason}`) : nothing}
      ${warnings.map((x) => alertBox('warn', x.text_he))}
      <div class="cols side-l"><div style="min-inline-size:0"><elec-bill-paper .snapshot=${s} watermark=${wm} .hash=${(b.snapshot_sha256 ?? '').slice(0, 12).replace(/(.{4})/g, '$1 ').trim()} .logo=${this.logoSrc()}></elec-bill-paper></div><div class="col">${side}</div></div>
      ${this.daily && s.tou ? this.dailyTable(s.tou) : nothing}
      ${this.dialogs(b)}
    </div>`;
  }

  /** BILL-start-reading: a draft whose meter has no opening reading at the period start (it started reporting later, or never): an
   *  administrator (energy.manage) may type what the physical meter showed then. It is saved as an audited manual reading of the meter
   *  at the period's first instant and the draft is computed again. */
  private openingCard(b: Bill) {
    const start = b.snapshot.period.start_utc;
    const open = b.snapshot.meters.filter((m) => m.start.kind === 'first_reading' || m.start.kind === 'none');
    if (b.state !== 'draft' || !start || !open.length || !energyAccess().manage) return nothing;
    return html`<div class="card" data-card="opening"><div class="hd"><b class="h3">${tr('קריאת פתיחה')}</b></div>
      <div class="list">${open.map((m) => html`<div class="row" data-opening-meter=${m.meter_id} style="flex-wrap:nowrap"><div class="grow"><div class="b">${m.name}</div><div class="mut">${m.start.reading_kwh === null ? readingText(null) : html`${n(readingText(m.start.reading_kwh))} · ${openingSource(m.start.kind)}`}</div></div>
        <sw-button size="sm" data-opening-enter @click=${() => this.openOpening(m)}>${tr('הזנה')}</sw-button></div>`)}</div></div>`;
  }
  private openOpening(m: SnapshotMeter) {
    this.open('opening');
    this.openingMeter = m;
    this.openingInfo = '';
  }
  private async saveOpening() {
    const b = this.bill as Bill;
    const m = this.openingMeter;
    const value = parseReading(this.text);
    const at = b.snapshot.period.start_utc;
    if (!m || value === null || !at || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await addManualReading(m.meter_id, { read_at: at, value, unit: 'kWh', note: this.reason.trim() || undefined });
      if (r.reading.effect !== 'allocation') {
        this.openingInfo = r.reading.message; // kept for comparison only: the bill does not change, say why
        return;
      }
      this.bill = await elec().recalcBill(b);
      this.close();
      await this.refreshEvents();
    } catch (e) {
      this.error = elecErrorText(e);
    } finally {
      this.busy = false;
    }
  }

  /** EL5: a time-of-use bill - kWh and amount per band over the period, and the daily table on request. */
  private touCard(s: BillSnapshot) {
    const t = s.tou;
    if (!t) return nothing;
    return html`<div class="card" data-card="tou"><div class="hd"><b class="h3">${tr('לפי שעות')}</b><span class="sp"></span>
        <button type="button" class="btn ghost sm" data-tou-daily aria-expanded=${this.daily ? 'true' : 'false'} @click=${() => (this.daily = !this.daily)}>${this.daily ? tr('הסתרת הפירוט היומי') : tr('פירוט יומי')}</button></div>
      <sw-table bare static-rows class="t" data-tou-bands .columns=${this.bandColumns(t) as unknown as TableColumn[]} .rows=${t.by_band as unknown as Record<string, unknown>[]}
        .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-band': (r as unknown as Tou['by_band'][number]).band.id })}></sw-table>
      ${t.special_days.some((d) => d.kind !== 'regular') ? html`<div class="mut" style="margin-block-start:8px">${tr('ימים מיוחדים:')} ${t.special_days.filter((d) => d.kind !== 'regular').map((d) => `${fmtDate(d.date)} ${d.name_he}`).join(', ')}</div>` : nothing}</div>`;
  }
  /** CR-CMP2-TABLES-CONSUMPTION-2450 (owner N10): the per-band sums as the shared sw-table (bare in the card, read-only; row hook
   * `data-band`) - figures as LTR isolates at the reading end. */
  private bandColumns(t: Tou): TableColumn<Tou['by_band'][number]>[] {
    return [
      { key: 'band', label: tr('פס'), render: (x) => html`<b>${touName('bands', x.band, t.names_en)}</b>` },
      { key: 'hours', label: tr('שעות'), kind: 'num', render: (x) => f2(x.hours) },
      { key: 'kwh', label: tr('קוט״ש'), kind: 'num', render: (x) => f2(x.kwh) },
      { key: 'amount', label: tr('לפני מע״מ'), kind: 'num', render: (x) => `${f2(x.amount_ex_vat)} ₪` },
    ];
  }
  /** CR-CMP2-TABLES-CONSUMPTION-2450: the daily table - the date, the day type (+ the special day's name as an info chip), one column per
   * band in use and the day's total (row hook `data-day`). */
  private dailyColumns(t: Tou, used: string[]): TableColumn<Tou['daily'][number]>[] {
    return [
      { key: 'date', label: tr('תאריך'), render: (d) => html`<span class="num">${fmtDate(d.date)}</span>` },
      {
        key: 'type',
        label: tr('סוג יום'),
        render: (d) =>
          html`${t.names.day_types[d.day_type] !== undefined ? touName('day_types', { id: d.day_type, name_he: t.names.day_types[d.day_type] }, t.names_en) : d.day_type}${d.special ? html` <span class="chip" data-tone="info" data-nodot>${d.special.name_he}</span>` : nothing}`,
      },
      ...used.map(
        (b): TableColumn<Tou['daily'][number]> => ({
          key: `band-${b}`,
          label: touName('bands', { id: b, name_he: t.names.bands[b] }, t.names_en),
          kind: 'num',
          render: (d) => {
            const v = d.bands.find((x) => x.band === b);
            return v ? f2(v.kwh) : '';
          },
        }),
      ),
      { key: 'total', label: tr('סה״כ'), kind: 'num', render: (d) => html`<b>${f2(d.kwh)}</b>` },
    ];
  }
  private dailyTable(t: NonNullable<BillSnapshot['tou']>) {
    const bands = Object.keys(t.names.bands);
    const used = bands.filter((b) => t.daily.some((d) => d.bands.some((x) => x.band === b)));
    return html`<div class="card flush" data-tou-daily-table><div class="hd"><b class="h3">${tr('פירוט יומי לפי שעות (קוט״ש)')}</b><span class="sp"></span><span class="mut">${tr('לעיון; כל ערך מעוגל בנפרד')}</span></div>
      <sw-table bare static-rows class="t" .columns=${this.dailyColumns(t, used) as unknown as TableColumn[]} .rows=${t.daily as unknown as Record<string, unknown>[]}
        .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-day': String(r.date) })}></sw-table></div>`;
  }

  /** One short line when the PDF cannot be had: the last request of this page failed, or the bill says failed / unavailable. Retry unless no engine. */
  private pdfNotice(b: Bill) {
    const st = b.pdf?.state;
    const code = b.pdf?.error_code || 'pdf_render_failed';
    const fail = this.pdfFail ?? (st === 'failed' ? { code, text: ERROR_TEXT[code] ?? ERROR_TEXT.pdf_render_failed } : st === 'unavailable' ? { code: 'pdf_unavailable', text: ERROR_TEXT.pdf_unavailable } : null);
    if (!fail) return nothing;
    const retry = PDF_RETRYABLE.includes(fail.code); // only a failure that can pass on its own: a bill without lines or a full-size PDF stays the same
    const shown = fail.code === 'pdf_unavailable' ? 'unavailable' : 'failed';
    return html`<div class="alert ${retry ? 'err' : 'warn'}" role="alert" data-pdf-error data-pdf-state=${shown} data-pdf-code=${fail.code}><span class="x" aria-hidden="true">!</span><div>${fail.text}</div>${retry ? html`<sw-button size="sm" data-pdf-retry @click=${() => void this.pdf(b.state === 'draft' ? 'view' : 'download')}>${tr('הפקת PDF מחדש')}</sw-button>` : nothing}</div>`;
  }

  private logoSrc(): string {
    const l = (this.bill as Bill).snapshot.business.logo;
    return l ? elec().logoUrl(l.sha256) : '';
  }

  // ---------------------------------------------------------------- dialogs
  private dialogs(b: Bill) {
    const err = this.error ? alertBox('err', this.error) : nothing;
    const cancel = (label = tr('ביטול')) => html`<sw-button slot="actions" @click=${() => this.close()}>${label}</sw-button>`;
    const nextRev = `${baseNumber(b.number ?? '')}-${b.revision + 1}`;
    const reasonEmpty = !this.reason.trim();
    return html`
      <elec-dialog heading=${tr('הנפקת חיוב')} ?open=${this.dlg === 'issue'} data-dialog="issue" @close=${() => this.close()}>
        <div>${tr('החיוב יקבל מספר. אחרי ההנפקה אי אפשר לערוך אותו, רק לבטל או לתקן.')}</div>
        <dl class="kv"><dt>${tr('חשבון')}</dt><dd>${b.account_name}</dd><dt>${tr('תקופה')}</dt><dd>${n(fmtRange(b.period.from, b.period.to))}</dd><dt>${tr('סה״כ לתשלום')}</dt><dd>${n(ilsOr(b.total))}</dd></dl>${err}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${() => this.issue()}>${tr('הנפקה')}</sw-button>${cancel()}
      </elec-dialog>
      <elec-dialog heading=${tr('ביטול חיוב {no}', { no: b.number ?? '' })} ?open=${this.dlg === 'void'} data-dialog="void" @close=${() => this.close()}>
        <div>${tr('החיוב יישאר ברשימה במצב בוטל. המספר לא ישמש שוב.')}</div>
        <div class="fld"><label for="vr">${tr('סיבת הביטול')}</label>
          <textarea id="vr" data-reason class="${reasonEmpty && this.reasonTouched ? 'err' : ''}" aria-required="true" placeholder=${tr('חובה')} .value=${this.reason} @input=${(e: Event) => { this.reason = (e.target as HTMLTextAreaElement).value; this.reasonTouched = true; }} @blur=${() => (this.reasonTouched = true)}></textarea>
          ${reasonEmpty && this.reasonTouched ? html`<div class="msg" role="alert" data-reason-error>${tr('צריך לכתוב סיבה')}</div>` : nothing}</div>${err}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy || reasonEmpty} @click=${() => void this.act(() => elec().voidBill(b.id, this.reason))}>${tr('ביטול החיוב')}</sw-button>${cancel(tr('חזרה'))}
      </elec-dialog>
      <elec-dialog heading=${tr('תיקון חיוב')} ?open=${this.dlg === 'correct'} data-dialog="correct" @close=${() => this.close()}>
        <div>${tr('תיווצר טיוטה מתוקנת')}${b.number ? html` ${tr('עם המספר')} <b class="num">${nextRev}</b>` : ''}. ${tr('כשהיא תונפק, החיוב')} ${n(b.number ?? '')} ${tr('יבוטל אוטומטית.')}</div>${err}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${() => void this.act(async () => { const d = await elec().correctBill(b.id); go(route.bill(d.id)); this.billId = d.id; })}>${tr('יצירת טיוטה מתוקנת')}</sw-button>${cancel()}
      </elec-dialog>
      <elec-dialog heading=${tr('סימון כנשלח')} ?open=${this.dlg === 'sent'} data-dialog="sent" @close=${() => this.close()}>
        <div class="form">
          <div class="fld"><label for="sd">${tr('תאריך משלוח')}</label><input id="sd" type="date" lang=${dateInputLang()} class="ltr ${isIsoDate(this.date) ? '' : 'err'}" data-date .value=${this.date} @change=${(e: Event) => (this.date = (e.target as HTMLInputElement).value)} /></div>
          <div class="fld"><span class="lbl">${tr('אופן משלוח')}</span><sw-segmented label=${tr('אופן משלוח')} value=${this.how} @change=${(e: CustomEvent<SegmentedChange>) => (this.how = e.detail.value as SentHow)}
        .options=${(['email', 'hand', 'other'] as SentHow[]).map((h) => ({ value: h, label: HOW[h], attrs: { 'data-how': h } }))}></sw-segmented></div>
        </div>${err}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy || !isIsoDate(this.date)} @click=${() => void this.act(() => elec().markSent(b.id, { at: this.date, how: this.how, note: '', row_version: b.row_version }))}>${tr('שמירה')}</sw-button>${cancel()}
      </elec-dialog>
      <elec-dialog heading=${tr('סימון כשולם')} ?open=${this.dlg === 'paid'} data-dialog="paid" @close=${() => this.close()}>
        <div class="form">
          <div class="fld"><label for="pd">${tr('תאריך תשלום')}</label><input id="pd" type="date" lang=${dateInputLang()} class="ltr ${isIsoDate(this.date) ? '' : 'err'}" data-date .value=${this.date} @change=${(e: Event) => (this.date = (e.target as HTMLInputElement).value)} /></div>
          <div class="fld"><label for="pr">${tr('אסמכתה (לא חובה)')}</label><input id="pr" class="ltr" data-reference placeholder=${tr('לא חובה')} .value=${this.text} @input=${(e: Event) => (this.text = (e.target as HTMLInputElement).value)} /></div>
        </div>${err}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy || !isIsoDate(this.date)} @click=${() => void this.act(() => elec().markPaid(b.id, { at: this.date, reference: this.text.trim(), row_version: b.row_version }))}>${tr('שמירה')}</sw-button>${cancel()}
      </elec-dialog>
      <elec-dialog heading=${tr('קריאת פתיחה - {name}', { name: this.openingMeter?.name ?? '' })} ?open=${this.dlg === 'opening'} data-dialog="opening" @close=${() => this.close()}>
        <div>${tr('מה הראה המונה ב-')}${n(fmtDate(b.period.from))} ${tr('בשעה 00:00. הצריכה מאז ועד הקריאה הראשונה שנקלטה תתווסף לחיוב.')}</div>
        <div class="form">
          <div class="fld"><label for="ov">${tr('קריאה (קוט״ש)')}</label><input id="ov" class="ltr ${this.text && parseReading(this.text) === null ? 'err' : ''}" inputmode="decimal" data-opening-value .value=${this.text} @input=${(e: Event) => (this.text = (e.target as HTMLInputElement).value)} /></div>
          <div class="fld"><label for="on">${tr('הערה (לא חובה)')}</label><input id="on" data-opening-note placeholder=${tr('לא חובה')} .value=${this.reason} @input=${(e: Event) => (this.reason = (e.target as HTMLInputElement).value)} /></div>
        </div>${this.openingInfo ? alertBox('warn', this.openingInfo) : nothing}${err}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy || parseReading(this.text) === null} @click=${() => void this.saveOpening()}>${tr('שמירה וחישוב מחדש')}</sw-button>${cancel()}
      </elec-dialog>
      <elec-dialog heading=${tr('מחיקת טיוטה')} ?open=${this.dlg === 'delete'} data-dialog="delete" @close=${() => this.close()}>
        <div>${tr('הטיוטה תימחק. אפשר ליצור אחרת מעמוד החשבון.')}</div>${err}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${() => void this.act(async () => { await elec().deleteDraft(b); go(route.bills()); })}>${tr('מחיקה')}</sw-button>${cancel()}
      </elec-dialog>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-bill-page': ElecBillPage;
  }
}
