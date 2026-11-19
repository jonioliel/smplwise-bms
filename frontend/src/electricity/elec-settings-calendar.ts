/**
 * EL5 (הגדרות › תשתיות › ימים מיוחדים): the holidays and holiday eves a time-of-use tariff counts as Saturday / Friday. The year's list
 * is computed from the Hebrew calendar by the server (Rosh Hashanah, Yom Kippur, Sukkot, Shemini Atzeret, Pesach, Shavuot, Independence
 * Day and their eves); the manager confirms it against a real bill, adds a day, retypes one, or cancels a computed one. Changing a day
 * never touches an issued bill; open drafts show it after "חישוב מחדש". Holders of energy.manage edit; the others read.
 */
import { html, nothing } from 'lit';
import '../components/sw-button';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import { customElement, state } from 'lit/decorators.js';
import { elec, elecErrorText, elecForbidden, elecToday, type CalendarDay, type CalendarYear } from '../api/electricity-billing';
import { energyAccess } from './access';
import { ElecBase, alertBox, n, skeleton, stateBox, type LoadState } from './elec-ui';
import { fmtDate, isIsoDate } from './elec-format';
import { WEEK, WEEK_HE } from './elec-tou';
import { dateInputLang } from '../api/day-format';
import { tr } from '../i18n/msg/electricity';
import '../components/sw-field';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';

const KINDS: { id: CalendarDay['kind']; label: string }[] = [
  { id: 'holiday', label: tr('חג (כמו שבת)') },
  { id: 'holiday_eve', label: tr('ערב חג (כמו שישי)') },
  { id: 'regular', label: tr('יום רגיל') },
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
      this.st = elecForbidden(e) ? 'forbidden' : 'error';
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
      this.note = k ? (k === 1 ? tr('טיוטה אחת מושפעת מהשינוי. השינוי יופיע בהן אחרי "חישוב מחדש".') : tr('{n} טיוטות מושפעות מהשינוי. השינוי יופיע בהן אחרי "חישוב מחדש".', { n: k })) : '';
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
    this.addErr = isIsoDate(a.date) ? '' : tr('צריך לבחור תאריך');
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
    if (!perms.view && !perms.bills && !perms.manage) return html`<div class="page" data-elec="settings-calendar" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה'))}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="settings-calendar" data-state="loading">${skeleton(5)}</div>`;
    if (this.st === 'forbidden') return html`<div class="page" data-elec="settings-calendar" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה'))}</div>`;
    if (this.st === 'error' || !this.data) return html`<div class="page" data-elec="settings-calendar" data-state="error">${stateBox('error', 'warning', tr('לא ניתן לטעון את הימים המיוחדים'), { label: tr('נסה שוב'), run: () => void this.load() })}</div>`;
    const d = this.data;
    const edit = perms.manage;
    const rows = d.days;
    return html`<div class="page" data-elec="settings-calendar" data-state="ready">
      ${this.error ? alertBox('err', this.error) : nothing}
      ${this.note ? alertBox('info', this.note) : nothing}
      <div class="card ${this.phone ? '' : 'flush'}">
        <div class="hd"><b class="h3">${tr('ימים מיוחדים')}</b>
          <div class="row" role="group" aria-label=${tr('שנה')}><sw-button variant="ghost" size="sm" iconOnly icon="chevronBack" label=${tr('השנה הקודמת')} data-year-prev @click=${() => this.setYear(this.year - 1)}></sw-button><b class="num" data-year>${this.year}</b><sw-button variant="ghost" size="sm" iconOnly icon="chevron" label=${tr('השנה הבאה')} data-year-next @click=${() => this.setYear(this.year + 1)}></sw-button></div>
          <span class="sp"></span>
          <sw-segmented label=${tr('מקור החגים')} value=${d.generator} ?disabled=${!edit || this.busy}
        @change=${(e: CustomEvent<SegmentedChange>) => { const g = e.detail.value as 'israel' | 'none'; if (d.generator !== g) void this.run(() => elec().setCalendarGenerator(g, d.revision, this.year)); }}
        .options=${[{ value: 'israel', label: tr('חגי ישראל מחושבים'), attrs: { 'data-generator': 'israel' } }, { value: 'none', label: tr('ימים ידניים בלבד'), attrs: { 'data-generator': 'none' } }]}></sw-segmented>
        </div>
        ${!rows.length ? html`<div class="mut" style="padding:0 16px 16px" data-calendar-empty>${tr('אין ימים מיוחדים בשנה הזו.')}</div>`
          : this.phone
            ? html`<div class="list" data-calendar>${rows.map((x) => html`<div class="li" data-day=${x.date} data-kind=${x.kind} style="flex-wrap:wrap"><div class="grow"><div class="t1">${x.name_he || x.kind_he}</div><div class="t2">${n(fmtDate(x.date))} · ${tr('יום {weekday}', { weekday: weekday(x.date) })} · ${x.source === 'manual' ? tr('ידני') : tr('מחושב')}</div></div>${this.kindCell(x, edit)}
                ${edit && x.source === 'manual' ? html`<sw-button variant="ghost" size="sm" data-restore=${x.date} ?disabled=${this.busy} @click=${() => this.restore(x)}>${x.generated ? tr('החזרה לחישוב') : tr('הסרה')}</sw-button>` : nothing}</div>`)}</div>`
            : html`<sw-table bare static-rows class="t" data-calendar .columns=${this.dayColumns(edit) as unknown as TableColumn[]} .rows=${rows as unknown as Record<string, unknown>[]}
                .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-day': String(r.date), 'data-kind': String(r.kind) })}></sw-table>`}
      </div>
      ${edit ? html`<div class="card" data-calendar-add><div class="hd"><b class="h3">${tr('הוספת יום')}</b></div>
        <div class="form">
          <div class="fld"><label for="cd">${tr('תאריך')}</label><input id="cd" type="date" lang=${dateInputLang()} class="ltr ${this.addErr ? 'err' : ''}" data-add-date .value=${this.add.date} @change=${(e: Event) => { this.add = { ...this.add, date: (e.target as HTMLInputElement).value }; this.addErr = ''; }} />${this.addErr ? html`<div class="msg" role="alert">${this.addErr}</div>` : nothing}</div>
          <div class="fld"><label for="ck">${tr('נחשב')}</label><select id="ck" data-add-kind @change=${(e: Event) => (this.add = { ...this.add, kind: (e.target as HTMLSelectElement).value as CalendarDay['kind'] })}>${KINDS.map((k) => html`<option value=${k.id} .selected=${k.id === this.add.kind}>${k.label}</option>`)}</select></div>
          <div class="fld wide"><label for="cn">${tr('שם (לא חובה)')}</label><input id="cn" data-add-name maxlength="60" .value=${this.add.name} @input=${(e: Event) => (this.add = { ...this.add, name: (e.target as HTMLInputElement).value })} /></div>
        </div>
        <div class="row" style="margin-block-start:12px"><sw-button variant="primary" data-add-day ?disabled=${this.busy} @click=${() => this.addDay()}>${tr('הוספה')}</sw-button></div></div>` : nothing}
      <div class="mut">${d.note_he}</div>
    </div>`;
  }

  /** CR-CMP2-TABLES-CONSUMPTION-2450 (owner N10): the special days as the shared sw-table (bare in the card, read-only rows; hooks
   * `data-day` + `data-kind`): the date, the weekday, the name, what the day counts as (a manager's select in the shared field), the source
   * as a chip in the shared tones (manual = warn, generated = neutral) and the restore / remove key. */
  private dayColumns(edit: boolean): TableColumn<CalendarDay>[] {
    return [
      { key: 'date', label: tr('תאריך'), render: (x) => html`<span class="num">${fmtDate(x.date)}</span>` },
      { key: 'weekday', label: tr('יום'), render: (x) => weekday(x.date) },
      { key: 'name', label: tr('שם'), render: (x) => html`<b>${x.name_he || (x.generated?.name_he ?? '')}</b>` },
      { key: 'kind', label: tr('נחשב'), render: (x) => this.kindCell(x, edit) },
      {
        key: 'source',
        label: tr('מקור'),
        kind: 'status',
        render: (x) => (x.source === 'manual' ? html`<span class="chip" data-tone="warn" data-nodot>${tr('ידני')}</span>` : html`<span class="chip" data-nodot>${tr('מחושב')}</span>`),
      },
      {
        key: 'act',
        label: '',
        kind: 'actions',
        render: (x) =>
          edit && x.source === 'manual'
            ? html`<sw-button variant="ghost" size="sm" data-restore=${x.date} ?disabled=${this.busy} @click=${() => this.restore(x)}>${x.generated ? tr('החזרה לחישוב') : tr('הסרה')}</sw-button>`
            : nothing,
      },
    ];
  }

  /** what the day counts as: a manager's select sits in the shared field (sw-field), a viewer reads it */
  private kindCell(x: CalendarDay, edit: boolean) {
    if (!edit) return html`<span>${x.kind_he}</span>`;
    return html`<sw-field part="field"><select aria-label=${tr('סוג היום {date}', { date: fmtDate(x.date) })} data-kind-select=${x.date} ?disabled=${this.busy} @change=${(e: Event) => this.setKind(x, (e.target as HTMLSelectElement).value as CalendarDay['kind'])}>${KINDS.map((k) => html`<option value=${k.id} .selected=${k.id === x.kind}>${k.label}</option>`)}</select></sw-field>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-settings-calendar': ElecSettingsCalendar;
  }
}
