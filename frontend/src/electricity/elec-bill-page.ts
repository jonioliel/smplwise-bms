/**
 * CR-023 §11/§12 (mockup "חיוב"): one bill - the A4 preview in every state (draft with a watermark, issued, sent, paid, cancelled with
 * a watermark and the reason, a corrected revision, a PDF failure with "create the PDF again" - from the last request or from the bill's
 * `pdf.state` failed / unavailable), the actions the server allows
 * (`bill.actions`) and their confirmation dialogs: issue, cancel with a mandatory reason, correct, mark sent, mark paid, delete a
 * draft. Any holder of the bills permission may issue and cancel (owner decision 5). The PDF itself is produced by the server; this
 * page only links to it.
 */
import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ERROR_TEXT, PDF_RETRYABLE, elec, elecErrorCode, elecErrorText, elecToday, type Bill, type BillAction, type BillEvent, type BillSnapshot, type SentHow } from '../api/electricity-billing';
import { energyAccess } from './access';
import { ElecBase, alertBox, billChip, n, skeleton, stateBox, type LoadState } from './elec-ui';
import './elec-bill-paper';
import { baseNumber, f2, fmtDate, fmtDateTime, fmtRange, isIsoDate } from './elec-format';
import { go, href, route } from './elec-routes';

type Dlg = '' | 'issue' | 'void' | 'correct' | 'sent' | 'paid' | 'delete';
const HOW: Record<SentHow, string> = { email: 'דוא״ל', hand: 'מסירה ידנית', other: 'אחר' };

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
    void this.act(() => elec().issueBill(b), async () => {
      // the first PDF is rendered when the bill is issued: a failure is shown at once, the bill stays issued
      await this.pdf('check');
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
      case 'issue': return html`<button type="button" class="btn pri" data-act="issue" @click=${() => this.open('issue')}>הנפקה</button>`;
      case 'sent': return html`<button type="button" class="btn ${b.state === 'issued' ? 'pri' : ''}" data-act="sent" @click=${() => this.open('sent')}>סימון כנשלח</button>`;
      case 'paid': return html`<button type="button" class="btn ${b.state === 'sent' ? 'pri' : ''}" data-act="paid" @click=${() => this.open('paid')}>סימון כשולם</button>`;
      case 'recalculate': return html`<button type="button" class="btn" data-act="recalculate" ?disabled=${this.busy} @click=${() => void this.act(() => elec().recalcBill(b))}>חישוב מחדש</button>`;
      case 'pdf': return b.state === 'draft'
        ? html`<button type="button" class="btn" data-act="pdf" @click=${() => void this.pdf('view')}>תצוגת PDF</button>`
        : html`<button type="button" class="btn" data-act="pdf" @click=${() => void this.pdf('download')}>הורדת PDF</button>`;
      case 'correct': return html`<button type="button" class="btn" data-act="correct" @click=${() => this.open('correct')}>תיקון</button>`;
      case 'void': return html`<button type="button" class="btn dng" data-act="void" @click=${() => this.open('void')}>ביטול</button>`;
      case 'delete': return html`<button type="button" class="btn dng" data-act="delete" @click=${() => this.open('delete')}>מחיקת טיוטה</button>`;
      default: return nothing;
    }
  }

  render() {
    if (!energyAccess().bills) return html`<div class="page" data-elec="bill" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה לחיובים')}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="bill" data-state="loading">${skeleton(4)}</div>`;
    if (this.st !== 'ready' || !this.bill)
      return html`<div class="page" data-elec="bill" data-state=${this.st}><div class="row"><a class="btn ghost sm" href=${href.bills()}>→ חיובים</a></div>${stateBox(this.st === 'forbidden' ? 'forbidden' : 'error', this.st === 'forbidden' ? 'lock' : 'warning', this.error || 'לא ניתן לטעון את החיוב', this.st === 'error' ? { label: 'נסה שוב', run: () => void this.load() } : undefined)}</div>`;
    const b = this.bill;
    const s = b.snapshot;
    const wm = b.state === 'draft' ? 'טיוטה' : b.state === 'void' ? 'בוטל' : '';
    const actions = html`${b.actions.map((a) => this.btn(a, b))}`;
    const warnings = b.state === 'draft' ? s.notes.filter((x) => x.code === 'meter_not_reporting' || x.code === 'carried_in') : [];
    const side = html`<div class="card"><div class="hd"><b class="h3">פרטים</b></div><dl class="kv" data-bill-details>
        <dt>חשבון</dt><dd><a class="lnk" href=${href.account(b.account_id)}>${b.account_name}</a></dd><dt>לקוח</dt><dd>${b.customer.name}</dd>
        <dt>תקופה</dt><dd>${n(fmtDate(b.period.from))} - ${n(fmtDate(b.period.to))}</dd>
        ${b.issue_date ? html`<dt>הונפק</dt><dd>${n(fmtDate(b.issue_date))}</dd>` : nothing}${b.due_date ? html`<dt>לתשלום עד</dt><dd>${n(fmtDate(b.due_date))}</dd>` : nothing}
        ${b.sent ? html`<dt>נשלח</dt><dd><span class="num" data-sent-at>${fmtDate(b.sent.at)}</span> · ${HOW[b.sent.how]}</dd>` : nothing}${b.paid ? html`<dt>שולם</dt><dd><span class="num" data-paid-at>${fmtDate(b.paid.at)}</span>${b.paid.reference ? html` · ${n(b.paid.reference)}` : nothing}</dd>` : nothing}
        <dt>מקור</dt><dd>${b.origin === 'auto' ? 'נוצר אוטומטית' : 'נוצר ידנית'}</dd></dl></div>
      ${this.touCard(s)}
      <div class="card"><div class="hd"><b class="h3">יומן</b></div><div class="list" data-bill-log>${this.events.map((e) => html`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${fmtDateTime(e.at)}</span><span>${e.text}</span></div>`)}</div></div>`;
    return html`<div class="page" data-elec="bill" data-state="ready" data-bill-state=${b.state} data-bill-id=${b.id}>
      <div class="row"><a class="btn ghost sm" href=${href.bills()} data-back>→ חיובים</a></div>
      <div class="row"><b class="h2 num" data-bill-number>${b.number ?? 'טיוטה'}</b>${billChip(b.state)}
        ${b.replaces_bill_id && s.bill.replaces ? html`<span class="mut">מחליף את <a class="lnk num" href=${href.bill(b.replaces_bill_id)}>${s.bill.replaces.number}</a></span>` : nothing}
        ${b.replaced_by_bill_id ? html`<span class="mut">הוחלף בחיוב <a class="lnk" href=${href.bill(b.replaced_by_bill_id)}>המתוקן</a></span>` : nothing}
        <span class="sp"></span>${this.phone ? nothing : actions}</div>
      ${this.phone ? html`<div class="row" data-actions>${actions}</div>` : nothing}
      ${this.pdfNotice(b)}
      ${b.state === 'void' && b.void ? alertBox('err', html`<b>בוטל:</b> ${b.void.reason}`) : nothing}
      ${warnings.map((x) => alertBox('warn', x.text_he))}
      <div class="cols side-l"><div style="min-inline-size:0"><elec-bill-paper .snapshot=${s} watermark=${wm} .hash=${(b.snapshot_sha256 ?? '').slice(0, 12).replace(/(.{4})/g, '$1 ').trim()} .logo=${this.logoSrc()}></elec-bill-paper></div><div class="col">${side}</div></div>
      ${this.daily && s.tou ? this.dailyTable(s.tou) : nothing}
      ${this.dialogs(b)}
    </div>`;
  }

  /** EL5: a time-of-use bill - kWh and amount per band over the period, and the daily table on request. */
  private touCard(s: BillSnapshot) {
    const t = s.tou;
    if (!t) return nothing;
    return html`<div class="card" data-card="tou"><div class="hd"><b class="h3">לפי שעות</b><span class="sp"></span>
        <button type="button" class="btn ghost sm" data-tou-daily aria-expanded=${this.daily ? 'true' : 'false'} @click=${() => (this.daily = !this.daily)}>${this.daily ? 'הסתרת הפירוט היומי' : 'פירוט יומי'}</button></div>
      <div class="scrollx"><table class="t" data-tou-bands><thead><tr><th>פס</th><th class="num">שעות</th><th class="num">קוט״ש</th><th class="num">לפני מע״מ</th></tr></thead>
        <tbody>${t.by_band.map((x) => html`<tr data-band=${x.band.id}><td class="b">${x.band.name_he}</td><td class="num">${f2(x.hours)}</td><td class="num">${f2(x.kwh)}</td><td class="num">${f2(x.amount_ex_vat)} ₪</td></tr>`)}</tbody></table></div>
      ${t.special_days.some((d) => d.kind !== 'regular') ? html`<div class="mut" style="margin-block-start:8px">ימים מיוחדים: ${t.special_days.filter((d) => d.kind !== 'regular').map((d) => `${fmtDate(d.date)} ${d.name_he}`).join(', ')}</div>` : nothing}</div>`;
  }
  private dailyTable(t: NonNullable<BillSnapshot['tou']>) {
    const bands = Object.keys(t.names.bands);
    const used = bands.filter((b) => t.daily.some((d) => d.bands.some((x) => x.band === b)));
    return html`<div class="card flush" data-tou-daily-table><div class="hd"><b class="h3">פירוט יומי לפי שעות (קוט״ש)</b><span class="sp"></span><span class="mut">לעיון; כל ערך מעוגל בנפרד</span></div>
      <div class="scrollx"><table class="t"><thead><tr><th>תאריך</th><th>סוג יום</th>${used.map((b) => html`<th class="num">${t.names.bands[b]}</th>`)}<th class="num">סה״כ</th></tr></thead>
        <tbody>${t.daily.map((d) => html`<tr data-day=${d.date}><td class="num" style="text-align:start">${fmtDate(d.date)}</td><td>${t.names.day_types[d.day_type] ?? d.day_type}${d.special ? html` <span class="chip c-acc nodot">${d.special.name_he}</span>` : nothing}</td>
          ${used.map((b) => { const v = d.bands.find((x) => x.band === b); return html`<td class="num">${v ? f2(v.kwh) : ''}</td>`; })}<td class="num b">${f2(d.kwh)}</td></tr>`)}</tbody></table></div></div>`;
  }

  /** One short line when the PDF cannot be had: the last request of this page failed, or the bill says failed / unavailable. Retry unless no engine. */
  private pdfNotice(b: Bill) {
    const st = b.pdf?.state;
    const code = b.pdf?.error_code || 'pdf_render_failed';
    const fail = this.pdfFail ?? (st === 'failed' ? { code, text: ERROR_TEXT[code] ?? ERROR_TEXT.pdf_render_failed } : st === 'unavailable' ? { code: 'pdf_unavailable', text: ERROR_TEXT.pdf_unavailable } : null);
    if (!fail) return nothing;
    const retry = PDF_RETRYABLE.includes(fail.code); // only a failure that can pass on its own: a bill without lines or a full-size PDF stays the same
    const shown = fail.code === 'pdf_unavailable' ? 'unavailable' : 'failed';
    return html`<div class="alert ${retry ? 'err' : 'warn'}" role="alert" data-pdf-error data-pdf-state=${shown} data-pdf-code=${fail.code}><span class="x" aria-hidden="true">!</span><div>${fail.text}</div>${retry ? html`<button type="button" class="btn sm" data-pdf-retry @click=${() => void this.pdf(b.state === 'draft' ? 'view' : 'download')}>הפקת PDF מחדש</button>` : nothing}</div>`;
  }

  private logoSrc(): string {
    const l = (this.bill as Bill).snapshot.business.logo;
    return l ? elec().logoUrl(l.sha256) : '';
  }

  // ---------------------------------------------------------------- dialogs
  private dialogs(b: Bill) {
    const err = this.error ? alertBox('err', this.error) : nothing;
    const cancel = (label = 'ביטול') => html`<button slot="actions" type="button" class="btn" @click=${() => this.close()}>${label}</button>`;
    const nextRev = `${baseNumber(b.number ?? '')}-${b.revision + 1}`;
    const reasonEmpty = !this.reason.trim();
    return html`
      <elec-dialog heading="הנפקת חיוב" ?open=${this.dlg === 'issue'} data-dialog="issue" @close=${() => this.close()}>
        <div>החיוב יקבל מספר. אחרי ההנפקה אי אפשר לערוך אותו, רק לבטל או לתקן.</div>
        <dl class="kv"><dt>חשבון</dt><dd>${b.account_name}</dd><dt>תקופה</dt><dd>${n(fmtRange(b.period.from, b.period.to))}</dd><dt>סה״כ לתשלום</dt><dd>${n(f2(b.total) + ' ₪')}</dd></dl>${err}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${() => this.issue()}>הנפקה</button>${cancel()}
      </elec-dialog>
      <elec-dialog heading=${`ביטול חיוב ${b.number ?? ''}`} ?open=${this.dlg === 'void'} data-dialog="void" @close=${() => this.close()}>
        <div>החיוב יישאר ברשימה במצב בוטל. המספר לא ישמש שוב.</div>
        <div class="fld"><label for="vr">סיבת הביטול</label>
          <textarea id="vr" data-reason class="${reasonEmpty && this.reasonTouched ? 'err' : ''}" aria-required="true" placeholder="חובה" .value=${this.reason} @input=${(e: Event) => { this.reason = (e.target as HTMLTextAreaElement).value; this.reasonTouched = true; }} @blur=${() => (this.reasonTouched = true)}></textarea>
          ${reasonEmpty && this.reasonTouched ? html`<div class="msg" role="alert" data-reason-error>צריך לכתוב סיבה</div>` : nothing}</div>${err}
        <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy || reasonEmpty} @click=${() => void this.act(() => elec().voidBill(b.id, this.reason))}>ביטול החיוב</button>${cancel('חזרה')}
      </elec-dialog>
      <elec-dialog heading="תיקון חיוב" ?open=${this.dlg === 'correct'} data-dialog="correct" @close=${() => this.close()}>
        <div>תיווצר טיוטה מתוקנת${b.number ? html` עם המספר <b class="num">${nextRev}</b>` : ''}. כשהיא תונפק, החיוב ${n(b.number ?? '')} יבוטל אוטומטית.</div>${err}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${() => void this.act(async () => { const d = await elec().correctBill(b.id); go(route.bill(d.id)); this.billId = d.id; })}>יצירת טיוטה מתוקנת</button>${cancel()}
      </elec-dialog>
      <elec-dialog heading="סימון כנשלח" ?open=${this.dlg === 'sent'} data-dialog="sent" @close=${() => this.close()}>
        <div class="form">
          <div class="fld"><label for="sd">תאריך משלוח</label><input id="sd" type="date" class="ltr ${isIsoDate(this.date) ? '' : 'err'}" data-date .value=${this.date} @change=${(e: Event) => (this.date = (e.target as HTMLInputElement).value)} /></div>
          <div class="fld"><span class="lbl">אופן משלוח</span><div class="seg" role="group" aria-label="אופן משלוח">${(['email', 'hand', 'other'] as SentHow[]).map((h) => html`<button type="button" data-how=${h} aria-pressed=${this.how === h} @click=${() => (this.how = h)}>${HOW[h]}</button>`)}</div></div>
        </div>${err}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy || !isIsoDate(this.date)} @click=${() => void this.act(() => elec().markSent(b.id, { at: this.date, how: this.how, note: '', row_version: b.row_version }))}>שמירה</button>${cancel()}
      </elec-dialog>
      <elec-dialog heading="סימון כשולם" ?open=${this.dlg === 'paid'} data-dialog="paid" @close=${() => this.close()}>
        <div class="form">
          <div class="fld"><label for="pd">תאריך תשלום</label><input id="pd" type="date" class="ltr ${isIsoDate(this.date) ? '' : 'err'}" data-date .value=${this.date} @change=${(e: Event) => (this.date = (e.target as HTMLInputElement).value)} /></div>
          <div class="fld"><label for="pr">אסמכתה (לא חובה)</label><input id="pr" class="ltr" data-reference placeholder="לא חובה" .value=${this.text} @input=${(e: Event) => (this.text = (e.target as HTMLInputElement).value)} /></div>
        </div>${err}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy || !isIsoDate(this.date)} @click=${() => void this.act(() => elec().markPaid(b.id, { at: this.date, reference: this.text.trim(), row_version: b.row_version }))}>שמירה</button>${cancel()}
      </elec-dialog>
      <elec-dialog heading="מחיקת טיוטה" ?open=${this.dlg === 'delete'} data-dialog="delete" @close=${() => this.close()}>
        <div>הטיוטה תימחק. אפשר ליצור אחרת מעמוד החשבון.</div>${err}
        <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy} @click=${() => void this.act(async () => { await elec().deleteDraft(b); go(route.bills()); })}>מחיקה</button>${cancel()}
      </elec-dialog>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-bill-page': ElecBillPage;
  }
}
