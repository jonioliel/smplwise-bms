import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { getCalendar, putCalendarDay, putWindowSettings, type CalendarReply, type HolidayRow } from '../api/door-windows';
import { dwt, type DwtKey } from '../i18n/door-windows';
import { dwe, type DweKey } from '../i18n/door-windows-events';
import { weekdayOf } from './logic';
import { KIND_TONE, canReset, holidayMonths, kindChoices, validDay, type DayKind } from './events-logic';
import { dwCss } from './styles';
import { dweCss } from './events-styles';
import { dateInputLang } from '../api/day-format';

const GENERATORS = ['israel', 'none'] as const;
type Pending = { text: string; run: () => Promise<unknown> };

/**
 * DOORWIN3-295 / CR-039 5.4: the holiday list of door windows (`GET /doors/windows/calendar`).
 *  - the generated Israeli holidays and eves for the next 400 days under the manager's overrides, grouped by month;
 *  - a manager sets the kind of any day (holiday, eve, regular, closed) or puts a generated day back to its default; every write is confirmed;
 *  - the system administrator picks the generator (`calendar_generator`: the list, or none).
 * Gated like the API: reading needs any visible door or the manager role; writing is `door_windows_manager` at the installation (the server
 * decides; a refusal is shown). The list is a default the manager confirms: which days a building is closed is the manager's decision.
 */
@customElement('door-holidays')
export class DoorHolidays extends LitElement {
  static styles = [dwCss, dweCss];

  @property({ type: Boolean }) open = false;
  @property({ type: Boolean }) canManage = false;
  @property({ type: Boolean }) canConfigure = false;
  /** the local today ("YYYY-MM-DD") - the list starts here */
  @property() today = '';
  @state() private cal: CalendarReply | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private pending: Pending | null = null;
  @state() private formError = '';
  @state() private add = { date: '', kind: 'holiday' as DayKind, label: '' };

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) void this.load();
  }

  private async load(): Promise<void> {
    this.error = '';
    try {
      this.cal = await getCalendar();
    } catch (err) {
      this.error = describeError(err);
    } finally {
    }
  }

  private tell(text: string): void {
    this.dispatchEvent(new CustomEvent('notice', { detail: text, bubbles: true, composed: true }));
  }

  private close(): void {
    this.pending = null;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private kindWord = (k: string): string => dwe(`dk_${k}` as DweKey);
  private dateWord(date: string): string {
    return `${dwt(`wd${weekdayOf(date)}` as DwtKey)} ${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
  }

  private askKind(row: Pick<HolidayRow, 'date' | 'name_he'>, kind: DayKind): void {
    this.pending = { text: dwe('hlConfirm', { date: this.dateWord(row.date), kind: this.kindWord(kind) }), run: () => putCalendarDay(row.date, kind, row.name_he) };
  }

  private askReset(row: HolidayRow): void {
    this.pending = { text: dwe('hlConfirmReset', { date: this.dateWord(row.date) }), run: () => putCalendarDay(row.date, 'none') };
  }

  private askGenerator(value: string): void {
    this.pending = { text: dwe('hlConfirmGenerator', { name: dwe(`gen_${value}` as DweKey) }), run: () => putWindowSettings({ 'doors.windows.calendar_generator': value }) };
  }

  private askAdd(): void {
    if (!validDay(this.add.date)) {
      this.formError = dwe('errHlDate');
      return;
    }
    this.formError = '';
    const { date, kind, label } = this.add;
    this.pending = {
      text: dwe('hlConfirm', { date: this.dateWord(date), kind: this.kindWord(kind) }),
      run: async () => {
        await putCalendarDay(date, kind, label.trim());
        this.add = { date: '', kind: 'holiday', label: '' };
      },
    };
  }

  private async confirm(): Promise<void> {
    const p = this.pending;
    if (!p) return;
    this.busy = true;
    try {
      await p.run();
      this.pending = null;
      this.tell(dwt('done'));
      await this.load();
      this.dispatchEvent(new CustomEvent('changed', { bubbles: true, composed: true }));
    } catch (err) {
      this.pending = null;
      this.tell(`${dwt('failed')}: ${describeError(err)}`);
    } finally {
      this.busy = false;
    }
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;
    return html`<sw-drawer open heading=${dwe('hlTitle')} @close=${() => this.close()}>
      <div class="form" data-dw-holidays>
        ${this.error ? html`<sw-state-panel quiet state="error" heading=${dwe('hlLoadError')} actionLabel=${dwt('retry')} data-dw-panel="error" @action=${() => void this.load()}></sw-state-panel>`
          : !this.cal ? html`<sw-state-panel quiet state="loading" heading=${dwe('hlLoading')} data-dw-panel="loading"></sw-state-panel>`
          : this.renderBody()}
      </div>
      ${this.renderPending()}
    </sw-drawer>`;
  }

  private renderBody(): TemplateResult {
    const cal = this.cal!;
    const months = holidayMonths(cal.holidays, this.today || cal.holidays[0]?.date || '');
    return html`
      <div class="field"><span class="lbl">${dwe('hlGenerator')}</span>
        ${this.canConfigure
          ? html`<div class="seg" role="group" data-dw-generator>${GENERATORS.map((g) => html`<button type="button" aria-pressed=${String(cal.generator === g)} data-dw-gen=${g}
              @click=${() => cal.generator !== g && this.askGenerator(g)}>${dwe(`gen_${g}` as DweKey)}</button>`)}</div>`
          : html`<div class="chips"><span class="chip" data-dw-generator-chip>${dwe(`gen_${cal.generator}` as DweKey)}</span></div>`}</div>
      ${months.length ? months.map((m) => html`<div class="card" data-dw-month=${m.month}>
        <b class="num">${m.month.slice(5, 7)}.${m.month.slice(0, 4)}</b>
        <ul class="lines">${m.rows.map((r) => this.renderRow(r))}</ul></div>`)
        : html`<div class="muted" data-dw-holidays-empty>${dwe('hlEmpty')}</div>`}
      ${this.canManage ? html`<div class="card" data-dw-add>
        <b>${dwe('hlAdd')}</b>
        <div class="row2">
          <div class="field"><label for="dwh-date">${dwe('hlColDate')}</label><input id="dwh-date" type="date" lang=${dateInputLang()} min=${this.today} .value=${this.add.date}
            @change=${(e: Event) => (this.add = { ...this.add, date: (e.target as HTMLInputElement).value })}></div>
          <div class="field"><label for="dwh-kind">${dwe('hlColKind')}</label><select id="dwh-kind" @change=${(e: Event) => (this.add = { ...this.add, kind: (e.target as HTMLSelectElement).value as DayKind })}>
            ${kindChoices(null).map((k) => html`<option value=${k} ?selected=${this.add.kind === k}>${this.kindWord(k)}</option>`)}</select></div>
          <div class="field"><label for="dwh-label">${dwe('hlLabel')}</label><input id="dwh-label" type="text" maxlength="60" .value=${this.add.label}
            @input=${(e: Event) => (this.add = { ...this.add, label: (e.target as HTMLInputElement).value })}></div>
        </div>
        ${this.formError ? html`<div class="err" role="alert">${this.formError}</div>` : nothing}
        <div class="footer"><sw-button variant="primary" size="sm" data-dw-add-save @click=${() => this.askAdd()}>${dwe('hlSave')}</sw-button></div>
      </div>` : nothing}`;
  }

  private renderRow(r: HolidayRow): TemplateResult {
    return html`<li data-dw-holiday=${r.date} data-dw-kind=${r.kind} data-dw-source=${r.source}>
      <span><b class="num">${this.dateWord(r.date)}</b> ${r.name_he ? html`<span class="muted">${r.name_he}</span>` : nothing}</span>
      <span class="chips">
        <span class="chip" data-tone=${KIND_TONE[r.kind]}>${this.kindWord(r.kind)}</span>
        <span class="chip" data-tone=${r.source === 'manual' ? 'warn' : 'off'}>${dwe(r.source === 'manual' ? 'hlSrcManual' : 'hlSrcGenerated')}</span>
        ${r.source === 'manual' && r.generated_kind ? html`<span class="chip" data-tone="off">${dwe('hlWas', { kind: this.kindWord(r.generated_kind) })}</span>` : nothing}
      </span>
      ${this.canManage ? html`<span class="acts">
        <select aria-label=${dwe('hlColKind')} data-dw-kind-pick @change=${(e: Event) => {
          const v = (e.target as HTMLSelectElement).value as DayKind;
          (e.target as HTMLSelectElement).value = r.kind; // the shown value changes only after the confirmed save
          if (v !== r.kind) this.askKind(r, v);
        }}>${kindChoices(r).map((k) => html`<option value=${k} ?selected=${r.kind === k}>${this.kindWord(k)}</option>`)}</select>
        ${canReset(r) ? html`<sw-button size="sm" variant="ghost" icon="refresh" data-dw-reset @click=${() => this.askReset(r)}>${dwe(r.generated_kind ? 'hlReset' : 'hlRemove')}</sw-button>` : nothing}
      </span>` : nothing}
    </li>`;
  }

  private renderPending(): TemplateResult | typeof nothing {
    const p = this.pending;
    if (!p) return nothing;
    return html`<sw-dialog open heading=${dwt('confirmTitle')} @close=${() => (this.pending = null)} data-dw-confirm>
      <p>${p.text}</p>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${() => (this.pending = null)}>${dwt('cancel')}</sw-button>
        <sw-button variant="primary" data-dw-confirm-btn ?disabled=${this.busy} @click=${() => void this.confirm()}>${dwt('confirmBtn')}</sw-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'door-holidays': DoorHolidays;
  }
}
