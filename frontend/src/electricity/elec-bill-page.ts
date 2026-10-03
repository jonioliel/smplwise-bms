/**
 * CR-023 §11/§12 (mockup "חיוב"): one bill - the A4 preview in every state (draft with a watermark, issued, sent, paid, cancelled with
 * a watermark and the reason, a corrected revision, a PDF failure with "create the PDF again"), the actions the server allows
 * (`bill.actions`) and their confirmation dialogs: issue, cancel with a mandatory reason, correct, mark sent, mark paid, delete a
 * draft. Any holder of the bills permission may issue and cancel (owner decision 5). The PDF itself is produced by the server; this
 * page only links to it.
 */
import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { elec, elecErrorCode, elecErrorText, elecPerms, elecToday, type Bill, type BillAction, type BillEvent, type SentHow } from '../api/electricity-billing';
import { ElecBase, alertBox, billChip, n, skeleton, stateBox, type LoadState } from './elec-ui';
import './elec-bill-paper';
import { f2, fmtDate, fmtDateTime, fmtRange, isIsoDate } from './elec-format';
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
  @state() private pdfError = '';
  @state() private reason = '';
  @state() private reasonTouched = false;
  @state() private date = '';
  @state() private how: SentHow = 'email';
  @state() private text = '';
  private loaded = '';

  willUpdate(ch: Map<string, unknown>) {
    if (ch.has('billId') && this.billId && this.loaded !== this.billId) {
      this.loaded = this.billId;
      void this.load();
    }
  }

  private async load() {
    this.st = 'loading';
    this.pdfError = '';
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
    this.pdfError = '';
    try {
      const blob = await elec().fetchPdf(b.id);
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
      this.pdfError = elecErrorText(e);
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
    if (!elecPerms().bills) return html`<div class="page" data-elec="bill" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה לחיובים')}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="bill" data-state="loading">${skeleton(4)}</div>`;
    if (this.st !== 'ready' || !this.bill)
      return html`<div class="page" data-elec="bill" data-state=${this.st}><div class="row"><a class="btn ghost sm" href=${href.bills()}>→ חיובים</a></div>${stateBox(this.st === 'forbidden' ? 'forbidden' : 'error', this.st === 'forbidden' ? 'lock' : 'warning', this.error || 'לא ניתן לטעון את החיוב', this.st === 'error' ? { label: 'נסה שוב', run: () => void this.load() } : undefined)}</div>`;
    const b = this.bill;
    const s = b.snapshot;
    const wm = b.state === 'draft' ? 'טיוטה' : b.state === 'void' ? 'בוטל' : '';
    const actions = html`${b.actions.map((a) => this.btn(a, b))}`;
    const warnings = b.state === 'draft' ? s.notes.filter((x) => x.code === 'meter_not_reporting' || x.code === 'carried_in') : [];
    const side = html`<div class="card"><div class="hd"><b class="h3">פרטים</b></div><dl class="kv">
        <dt>חשבון</dt><dd><a class="lnk" href=${href.account(b.account_id)}>${b.account_name}</a></dd><dt>לקוח</dt><dd>${b.customer.name}</dd>
        <dt>תקופה</dt><dd>${n(fmtDate(b.period.from))} - ${n(fmtDate(b.period.to))}</dd>
        ${b.issue_date ? html`<dt>הונפק</dt><dd>${n(fmtDate(b.issue_date))}</dd>` : nothing}${b.due_date ? html`<dt>לתשלום עד</dt><dd>${n(fmtDate(b.due_date))}</dd>` : nothing}
        ${b.sent ? html`<dt>נשלח</dt><dd>${n(fmtDate(b.sent.at))} · ${HOW[b.sent.how]}</dd>` : nothing}${b.paid ? html`<dt>שולם</dt><dd>${n(fmtDate(b.paid.at))}${b.paid.reference ? html` · ${n(b.paid.reference)}` : nothing}</dd>` : nothing}
        <dt>מקור</dt><dd>${b.origin === 'auto' ? 'נוצר אוטומטית' : 'נוצר ידנית'}</dd></dl></div>
      <div class="card"><div class="hd"><b class="h3">יומן</b></div><div class="list" data-bill-log>${this.events.map((e) => html`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${fmtDateTime(e.at)}</span><span>${e.text}</span></div>`)}</div></div>`;
    return html`<div class="page" data-elec="bill" data-state="ready" data-bill-state=${b.state} data-bill-id=${b.id}>
      <div class="row"><a class="btn ghost sm" href=${href.bills()} data-back>→ חיובים</a></div>
      <div class="row"><b class="h2 num" data-bill-number>${b.number ?? 'טיוטה'}</b>${billChip(b.state)}
        ${b.replaces_bill_id && s.bill.replaces ? html`<span class="mut">מחליף את <a class="lnk num" href=${href.bill(b.replaces_bill_id)}>${s.bill.replaces.number}</a></span>` : nothing}
        ${b.replaced_by_bill_id ? html`<span class="mut">הוחלף בחיוב <a class="lnk" href=${href.bill(b.replaced_by_bill_id)}>המתוקן</a></span>` : nothing}
        <span class="sp"></span>${this.phone ? nothing : actions}</div>
      ${this.phone ? html`<div class="row" data-actions>${actions}</div>` : nothing}
      ${this.pdfError ? html`<div class="alert err" role="alert" data-pdf-error><span class="x" aria-hidden="true">!</span><div>${this.pdfError}</div><button type="button" class="btn sm" data-pdf-retry @click=${() => void this.pdf('download')}>יצירת PDF מחדש</button></div>` : nothing}
      ${b.state === 'void' && b.void ? alertBox('err', html`<b>בוטל:</b> ${b.void.reason}`) : nothing}
      ${warnings.map((x) => alertBox('warn', x.text_he))}
      <div class="cols side-l"><div style="min-inline-size:0"><elec-bill-paper .snapshot=${s} watermark=${wm} .hash=${(b.snapshot_sha256 ?? '').slice(0, 12).replace(/(.{4})/g, '$1 ').trim()} .logo=${this.logoSrc()}></elec-bill-paper></div><div class="col">${side}</div></div>
      ${this.dialogs(b)}
    </div>`;
  }

  private logoSrc(): string {
    const l = (this.bill as Bill).snapshot.business.logo;
    return l ? elec().logoUrl(l.sha256) : '';
  }

  // ---------------------------------------------------------------- dialogs
  private dialogs(b: Bill) {
    const err = this.error ? alertBox('err', this.error) : nothing;
    const cancel = (label = 'ביטול') => html`<button slot="actions" type="button" class="btn" @click=${() => this.close()}>${label}</button>`;
    const nextRev = `${(b.snapshot.bill.replaces ? b.snapshot.bill.replaces.number : b.number ?? '').replace(/-\d+$/, '')}-${b.revision + 1}`;
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
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy || !isIsoDate(this.date)} @click=${() => void this.act(() => elec().markSent(b.id, { at: this.date, how: this.how, note: '' }))}>שמירה</button>${cancel()}
      </elec-dialog>
      <elec-dialog heading="סימון כשולם" ?open=${this.dlg === 'paid'} data-dialog="paid" @close=${() => this.close()}>
        <div class="form">
          <div class="fld"><label for="pd">תאריך תשלום</label><input id="pd" type="date" class="ltr ${isIsoDate(this.date) ? '' : 'err'}" data-date .value=${this.date} @change=${(e: Event) => (this.date = (e.target as HTMLInputElement).value)} /></div>
          <div class="fld"><label for="pr">אסמכתה (לא חובה)</label><input id="pr" class="ltr" data-reference placeholder="לא חובה" .value=${this.text} @input=${(e: Event) => (this.text = (e.target as HTMLInputElement).value)} /></div>
        </div>${err}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy || !isIsoDate(this.date)} @click=${() => void this.act(() => elec().markPaid(b.id, { at: this.date, reference: this.text.trim() }))}>שמירה</button>${cancel()}
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
