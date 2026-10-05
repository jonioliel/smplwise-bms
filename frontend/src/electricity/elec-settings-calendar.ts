/**
 * EL5 (הגדרות › תשתיות › ימים מיוחדים): the holidays and holiday eves a time-of-use tariff counts as Saturday / Friday. The year's list
 * is computed from the Hebrew calendar by the server (Rosh Hashanah, Yom Kippur, Sukkot, Shemini Atzeret, Pesach, Shavuot, Independence
 * Day and their eves); the manager confirms it against a real bill, adds a day, retypes one, or cancels a computed one. Changing a day
 * never touches an issued bill; open drafts show it after "חישוב מחדש". Holders of energy.manage edit; the others read.
 */
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { elec, elecErrorText, elecToday, type CalendarDay, type CalendarYear } from '../api/electricity-billing';
import { energyAccess } from './access';
import { ElecBase, alertBox, n, skeleton, stateBox, type LoadState } from './elec-ui';
import { fmtDate, isIsoDate } from './elec-format';
import { WEEK, WEEK_HE } from './elec-tou';

const KINDS: { id: CalendarDay['kind']; label: string }[] = [
  { id: 'holiday', label: 'חג (כמו שבת)' },
  { id: 'holiday_eve', label: 'ערב חג (כמו שישי)' },
  { id: 'regular', label: 'יום רגיל' },
];
const weekday = (iso: string): string => WEEK_HE[WEEK[new Date(`${iso}T12:00:00Z`).getUTCDay()]];

@customElement('elec-settings-calendar')
export class ElecSettingsCalendar extends ElecBase {
  @state() private st: LoadState = 'loading';
  @state() private year = Number(elecToday().slice(0, 4));
  @state() private data: CalendarYear | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private note = '';
  @state() private add = { date: '', kind: 'holiday' as CalendarDay['kind'], name: '' };
  @state() private addErr = '';

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }
  private async load() {
    this.st = 'loading';
    try {
      this.data = await elec().getCalendar(this.year);
      this.st = 'ready';
    } catch (e) {
      this.error = elecErrorText(e);
      this.st = /הרשאה/.test(this.error) ? 'forbidden' : 'error';
    }
  }
  private setYear(y: number) {
    this.year = y;
    this.note = '';
    void this.load();
  }
  private async run(fn: () => Promise<CalendarYear>) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await fn();
      this.data = r.year === this.year ? r : await elec().getCalendar(this.year);
      const k = r.drafts_to_recalculate ?? 0;
      this.note = k ? `${k === 1 ? 'טיוטה אחת מושפעת' : `${k} טיוטות מושפעות`} מהשינוי. השינוי יופיע בהן אחרי "חישוב מחדש".` : '';
    } catch (e) {
      this.error = elecErrorText(e);
    } finally {
      this.busy = false;
    }
  }
  private setKind(d: CalendarDay, kind: CalendarDay['kind']) {
    if (!this.data) return;
    const rev = this.data.revision;
    void this.run(() => elec().setCalendarDay(d.date, kind, d.name_he, rev));
  }
  private restore(d: CalendarDay) {
    if (!this.data) return;
    const rev = this.data.revision;
    void this.run(() => elec().removeCalendarDay(d.date, rev));
  }
  private addDay() {
    const a = this.add;
    this.addErr = isIsoDate(a.date) ? '' : 'צריך לבחור תאריך';
    if (this.addErr || !this.data) return;
    const rev = this.data.revision;
    void this.run(async () => {
      const r = await elec().setCalendarDay(a.date, a.kind, a.name, rev);
      this.add = { date: '', kind: 'holiday', name: '' };
      if (Number(a.date.slice(0, 4)) !== this.year) this.year = Number(a.date.slice(0, 4));
      return r;
    });
  }

  render() {
    const perms = energyAccess();
    if (!perms.view && !perms.bills && !perms.manage) return html`<div class="page" data-elec="settings-calendar" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה')}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="settings-calendar" data-state="loading">${skeleton(5)}</div>`;
    if (this.st === 'forbidden') return html`<div class="page" data-elec="settings-calendar" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה')}</div>`;
    if (this.st === 'error' || !this.data) return html`<div class="page" data-elec="settings-calendar" data-state="error">${stateBox('error', 'warning', 'לא ניתן לטעון את הימים המיוחדים', { label: 'נסה שוב', run: () => void this.load() })}</div>`;
    const d = this.data;
    const edit = perms.manage;
    const rows = d.days;
    return html`<div class="page" data-elec="settings-calendar" data-state="ready">
      ${this.error ? alertBox('err', this.error) : nothing}
      ${this.note ? alertBox('info', this.note) : nothing}
      <div class="card ${this.phone ? '' : 'flush'}">
        <div class="hd"><b class="h3">ימים מיוחדים</b>
          <div class="row" role="group" aria-label="שנה"><button type="button" class="btn ghost sm ic" aria-label="השנה הקודמת" data-year-prev @click=${() => this.setYear(this.year - 1)}>→</button><b class="num" data-year>${this.year}</b><button type="button" class="btn ghost sm ic" aria-label="השנה הבאה" data-year-next @click=${() => this.setYear(this.year + 1)}>←</button></div>
          <span class="sp"></span>
          <div class="seg" role="group" aria-label="מקור החגים"><button type="button" data-generator="israel" aria-pressed=${d.generator === 'israel'} ?disabled=${!edit || this.busy} @click=${() => d.generator !== 'israel' && void this.run(() => elec().setCalendarGenerator('israel', d.revision, this.year))}>חגי ישראל מחושבים</button><button type="button" data-generator="none" aria-pressed=${d.generator === 'none'} ?disabled=${!edit || this.busy} @click=${() => d.generator !== 'none' && void this.run(() => elec().setCalendarGenerator('none', d.revision, this.year))}>ימים ידניים בלבד</button></div>
        </div>
        ${!rows.length ? html`<div class="mut" style="padding:0 16px 16px" data-calendar-empty>אין ימים מיוחדים בשנה הזו.</div>`
          : this.phone
            ? html`<div class="list" data-calendar>${rows.map((x) => html`<div class="li" data-day=${x.date} data-kind=${x.kind} style="flex-wrap:wrap"><div class="grow"><div class="t1">${x.name_he || x.kind_he}</div><div class="t2">${n(fmtDate(x.date))} · יום ${weekday(x.date)} · ${x.source === 'manual' ? 'ידני' : 'מחושב'}</div></div>${this.kindCell(x, edit)}
                ${edit && x.source === 'manual' ? html`<button type="button" class="btn ghost sm" data-restore=${x.date} ?disabled=${this.busy} @click=${() => this.restore(x)}>${x.generated ? 'החזרה לחישוב' : 'הסרה'}</button>` : nothing}</div>`)}</div>`
            : html`<div class="scrollx"><table class="t" data-calendar><thead><tr><th>תאריך</th><th>יום</th><th>שם</th><th>נחשב</th><th>מקור</th><th></th></tr></thead><tbody>
              ${rows.map((x) => html`<tr data-day=${x.date} data-kind=${x.kind}><td class="num" style="text-align:start">${fmtDate(x.date)}</td><td>${weekday(x.date)}</td><td class="b">${x.name_he || (x.generated?.name_he ?? '')}</td><td>${this.kindCell(x, edit)}</td>
                <td>${x.source === 'manual' ? html`<span class="chip c-warn nodot">ידני</span>` : html`<span class="chip c-mut nodot">מחושב</span>`}</td>
                <td>${edit ? (x.source === 'manual'
                  ? html`<button type="button" class="btn ghost sm" data-restore=${x.date} ?disabled=${this.busy} @click=${() => this.restore(x)}>${x.generated ? 'החזרה לחישוב' : 'הסרה'}</button>`
                  : nothing) : nothing}</td></tr>`)}</tbody></table></div>`}
      </div>
      ${edit ? html`<div class="card" data-calendar-add><div class="hd"><b class="h3">הוספת יום</b></div>
        <div class="form">
          <div class="fld"><label for="cd">תאריך</label><input id="cd" type="date" class="ltr ${this.addErr ? 'err' : ''}" data-add-date .value=${this.add.date} @change=${(e: Event) => { this.add = { ...this.add, date: (e.target as HTMLInputElement).value }; this.addErr = ''; }} />${this.addErr ? html`<div class="msg" role="alert">${this.addErr}</div>` : nothing}</div>
          <div class="fld"><label for="ck">נחשב</label><select id="ck" data-add-kind @change=${(e: Event) => (this.add = { ...this.add, kind: (e.target as HTMLSelectElement).value as CalendarDay['kind'] })}>${KINDS.map((k) => html`<option value=${k.id} .selected=${k.id === this.add.kind}>${k.label}</option>`)}</select></div>
          <div class="fld wide"><label for="cn">שם (לא חובה)</label><input id="cn" data-add-name maxlength="60" .value=${this.add.name} @input=${(e: Event) => (this.add = { ...this.add, name: (e.target as HTMLInputElement).value })} /></div>
        </div>
        <div class="row" style="margin-block-start:12px"><button type="button" class="btn pri" data-add-day ?disabled=${this.busy} @click=${() => this.addDay()}>הוספה</button></div></div>` : nothing}
      <div class="mut">${d.note_he}</div>
    </div>`;
  }

  private kindCell(x: CalendarDay, edit: boolean) {
    if (!edit) return html`<span>${x.kind_he}</span>`;
    return html`<select aria-label=${`סוג היום ${fmtDate(x.date)}`} data-kind-select=${x.date} ?disabled=${this.busy} @change=${(e: Event) => this.setKind(x, (e.target as HTMLSelectElement).value as CalendarDay['kind'])}>${KINDS.map((k) => html`<option value=${k.id} .selected=${k.id === x.kind}>${k.label}</option>`)}</select>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-settings-calendar': ElecSettingsCalendar;
  }
}
