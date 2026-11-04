import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import './sw-week-grid';
import './wk-action-button';
import type { WeekdayName } from '../api/access-stations';
import type { Draft } from '../api/schedule-writes';
import { dateInputLang } from '../api/day-format'; // DATEFMT60-295: Hebrew lang on date / time inputs
import type { WeekDays } from './sw-week-grid';
import {
  DAYS_UI,
  MAX_PERIODS,
  WORKDAYS,
  addHoliday,
  addPeriod,
  copyDay,
  editHoliday,
  editPeriod,
  faultAt,
  gridOf,
  removeHoliday,
  removePeriod,
  weekFromGrid,
  weekMinutes,
  type DraftFault,
} from '../access-control/schedule-editor-logic';
import { DAY_NAMES, DAY_SHORT, reasonOf, sed } from '../i18n/schedule-editor';

/**
 * The editable form of one library schedule (WISKEY-SCHED-WRITE-2390): its name, the week - a painted hour grid for a quick shape
 * (desktop) and, per day, exact windows with two time fields each (every layout; the phone's way) - and the special dates (holidays)
 * with their own windows. Pure presentation: every edit emits `draft-change` with the new draft; the faults come from the owner
 * (schedule-editor-logic `faults`, the integration's own rules) and are shown at the field they concern.
 */
@customElement('wk-schedule-draft-form')
export class WkScheduleDraftForm extends LitElement {
  @property({ attribute: false }) draft!: Draft;
  @property({ attribute: false }) faults: DraftFault[] = [];
  @property({ type: Boolean }) narrow = false;
  @property() today = '2026-01-01';
  @property({ type: Boolean, reflect: true }) disabled = false;

  static styles = css`
    :host {
      display: block;
      --se-hit: var(--sw-touch-desktop, 44px);
    }
    @media (max-width: 1100px) {
      :host {
        --se-hit: 44px;
      }
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding-block: var(--sw-s-3);
    }
    .sec + .sec {
      border-block-start: 1px solid var(--sw-border);
    }
    h4 {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    h4 .sum {
      margin-inline-start: auto;
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
    }
    label.field {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    input {
      box-sizing: border-box;
      min-block-size: var(--se-hit);
      padding: 0 var(--sw-s-3);
      border: 1px solid var(--sw-border-strong, var(--sw-border));
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: max(16px, var(--sw-fs-sm));
      font-variant-numeric: tabular-nums;
      transition: border-color var(--sw-t-fast) var(--sw-ease);
    }
    input:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 1px;
    }
    input[aria-invalid='true'] {
      border-color: var(--sw-danger);
    }
    input[type='time'],
    input[type='date'] {
      direction: ltr;
      min-inline-size: 0;
    }
    .name input {
      inline-size: 100%;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    .hint {
      margin: 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .days {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
    }
    .day {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr);
      gap: var(--sw-s-2);
      align-items: start;
      padding-block: var(--sw-s-1);
    }
    .day .dn {
      min-block-size: var(--se-hit);
      display: flex;
      align-items: center;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .wins {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2);
      min-inline-size: 0;
    }
    .win {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-1);
      padding-inline-end: 2px;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft, var(--sw-surface-2));
    }
    .win input {
      inline-size: 8.8em; /* room for a 12-hour browser format too (08:00 AM) */
      border-color: transparent;
      background: transparent;
    }
    .win[data-bad] {
      outline: 1px solid var(--sw-danger);
    }
    .closed {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      min-block-size: var(--se-hit);
      display: inline-flex;
      align-items: center;
    }
    button.x {
      inline-size: var(--se-hit);
      block-size: var(--se-hit);
      display: inline-grid;
      place-items: center;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    button.x:active {
      transform: scale(var(--sw-press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      button.x:hover {
        background: var(--sw-hover-wash);
        color: var(--sw-text);
      }
    }
    .hol {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: var(--sw-s-2);
      align-items: end;
      padding: var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
    }
    .hol .wins {
      grid-column: 1 / -1;
    }
    .hol input {
      inline-size: 100%;
    }
    @media (max-width: 640px) {
      .hol {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      }
      .hol .hn {
        grid-column: 1 / -1;
      }
    }
    sw-week-grid {
      max-inline-size: 100%;
      overflow-x: auto;
    }
  `;

  private emit(d: Draft) {
    this.dispatchEvent(new CustomEvent<Draft>('draft-change', { detail: d, bubbles: true, composed: true }));
  }

  private fault(where: string) {
    const f = faultAt(this.faults, where);
    return f ? html`<span class="err" role="alert" data-se-fault=${where}>${reasonOf(f.code)}</span>` : nothing;
  }

  render() {
    const d = this.draft;
    if (!d) return nothing;
    const nameBad = !!faultAt(this.faults, 'name');
    return html`
      <div class="sec">
        <label class="field name">${sed('name')}
          <input data-se-name maxlength="32" .value=${d.name} placeholder=${sed('namePlaceholder')} aria-invalid=${String(nameBad)} ?disabled=${this.disabled}
            @input=${(e: Event) => this.emit({ ...d, name: (e.target as HTMLInputElement).value })} />
        </label>
        ${this.fault('name')}
      </div>
      <div class="sec" data-se-week>
        <h4><sw-icon name="calendar" size=${14}></sw-icon>${sed('weekTitle')}<span class="sum" data-se-hours>${sed('summaryHours', { h: Math.round((weekMinutes(d.weekly) / 60) * 10) / 10 })}</span></h4>
        ${this.narrow
          ? nothing
          : html`<sw-week-grid data-se-grid ?editable=${!this.disabled} .days=${gridOf(d.weekly)} .modes=${[{ id: 'on', label: sed('weekTitle'), color: 'var(--sw-accent)' }]}
                @change=${(e: CustomEvent<{ days: WeekDays }>) => this.emit({ ...d, weekly: weekFromGrid(e.detail.days, d.weekly) })}></sw-week-grid>
              <p class="hint">${sed('gridHint')}</p>`}
        <div class="days">${DAYS_UI.map((day) => this.renderDay(day))}</div>
      </div>
      <div class="sec" data-se-holidays>
        <h4><sw-icon name="star" size=${14}></sw-icon>${sed('holidaysTitle')}<span class="sum">${d.holidays.length || ''}</span></h4>
        <p class="hint">${sed('holidaysHint')}</p>
        ${this.fault('holidays')}
        ${d.holidays.map((_h, i) => this.renderHoliday(i))}
        <div><wk-action-button tone="dashed" icon="plus" data-se-add-holiday ?disabled=${this.disabled || d.holidays.length >= 64}
          @click=${() => this.emit(addHoliday(d, this.today))}>${sed('addHoliday')}</wk-action-button></div>
      </div>
    `;
  }

  private renderDay(day: WeekdayName) {
    const d = this.draft;
    const ps = d.weekly[day] ?? [];
    const label = this.narrow ? DAY_SHORT[day] : DAY_NAMES[day];
    return html`<div class="day" data-se-day=${day}>
      <span class="dn" title=${DAY_NAMES[day]}>${label}</span>
      <div class="wins">
        ${ps.length ? nothing : html`<span class="closed">${sed('closedDay')}</span>`}
        ${ps.map((p, i) => {
          const bad = !!faultAt(this.faults, `weekly.${day}.${i}`);
          return html`<span class="win" data-se-win=${`${day}.${i}`} ?data-bad=${bad}>
            <input type="time" lang=${dateInputLang()} step="60" aria-label=${`${DAY_NAMES[day]} ${sed('from')}`} .value=${p.start} ?disabled=${this.disabled} data-se-start
              @change=${(e: Event) => this.emit(editPeriod(d, day, i, 'start', (e.target as HTMLInputElement).value))} />
            <span aria-hidden="true">–</span>
            <input type="time" lang=${dateInputLang()} step="60" aria-label=${`${DAY_NAMES[day]} ${sed('to')}`} .value=${p.end === '24:00' ? '23:59' : p.end} ?disabled=${this.disabled} data-se-end
              @change=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                this.emit(editPeriod(d, day, i, 'end', v === '23:59' && p.end === '24:00' ? '24:00' : v));
              }} />
            <button class="x" type="button" aria-label=${sed('removeWindow')} data-se-remove-win ?disabled=${this.disabled} @click=${() => this.emit(removePeriod(d, day, i))}><sw-icon name="close" size=${14}></sw-icon></button>
          </span>`;
        })}
        <button class="x" type="button" aria-label=${`${sed('addWindow')} · ${DAY_NAMES[day]}`} title=${sed('addWindow')} data-se-add-win=${day}
          ?disabled=${this.disabled || ps.length >= MAX_PERIODS} @click=${() => this.emit(addPeriod(d, day))}><sw-icon name="plus" size=${16}></sw-icon></button>
        ${day === 'Sunday' && ps.length
          ? html`<wk-action-button tone="quiet" icon="copy" data-se-copy ?disabled=${this.disabled} @click=${() => this.emit(copyDay(d, 'Sunday', WORKDAYS))}>${sed('copyTo')}</wk-action-button>`
          : nothing}
        ${this.fault(`weekly.${day}`)}
      </div>
    </div>`;
  }

  private renderHoliday(i: number) {
    const d = this.draft;
    const h = d.holidays[i];
    const w = `holidays.${i}`;
    return html`<div class="hol" data-se-holiday=${i}>
      <label class="field hn">${sed('holidayName')}
        <input maxlength="32" .value=${h.name} aria-invalid=${String(!!faultAt(this.faults, `${w}.name`))} ?disabled=${this.disabled} data-se-hname
          @input=${(e: Event) => this.emit(editHoliday(d, i, { name: (e.target as HTMLInputElement).value }))} />
      </label>
      <label class="field">${sed('holidayFrom')}
        <input type="date" lang=${dateInputLang()} .value=${h.start} aria-invalid=${String(!!faultAt(this.faults, `${w}.start`))} ?disabled=${this.disabled} data-se-hstart
          @change=${(e: Event) => this.emit(editHoliday(d, i, { start: (e.target as HTMLInputElement).value }))} />
      </label>
      <label class="field">${sed('holidayTo')}
        <input type="date" lang=${dateInputLang()} .value=${h.end} aria-invalid=${String(!!faultAt(this.faults, `${w}.end`))} ?disabled=${this.disabled} data-se-hend
          @change=${(e: Event) => this.emit(editHoliday(d, i, { end: (e.target as HTMLInputElement).value }))} />
      </label>
      <button class="x" type="button" aria-label=${sed('removeHoliday')} data-se-remove-holiday ?disabled=${this.disabled} @click=${() => this.emit(removeHoliday(d, i))}><sw-icon name="trash" size=${16}></sw-icon></button>
      <div class="wins">
        ${h.periods.length ? nothing : html`<span class="closed">${sed('holidayClosed')}</span>`}
        ${h.periods.map((p, k) => html`<span class="win" ?data-bad=${!!faultAt(this.faults, `${w}.periods.${k}`)}>
          <input type="time" lang=${dateInputLang()} step="60" aria-label=${`${h.name} ${sed('from')}`} .value=${p.start} ?disabled=${this.disabled}
            @change=${(e: Event) => this.emit(editHoliday(d, i, { periods: h.periods.map((x, j) => (j === k ? { ...x, start: (e.target as HTMLInputElement).value } : x)) }))} />
          <span aria-hidden="true">–</span>
          <input type="time" lang=${dateInputLang()} step="60" aria-label=${`${h.name} ${sed('to')}`} .value=${p.end === '24:00' ? '23:59' : p.end} ?disabled=${this.disabled}
            @change=${(e: Event) => this.emit(editHoliday(d, i, { periods: h.periods.map((x, j) => (j === k ? { ...x, end: (e.target as HTMLInputElement).value } : x)) }))} />
          <button class="x" type="button" aria-label=${sed('removeWindow')} ?disabled=${this.disabled}
            @click=${() => this.emit(editHoliday(d, i, { periods: h.periods.filter((_, j) => j !== k) }))}><sw-icon name="close" size=${14}></sw-icon></button>
        </span>`)}
        <button class="x" type="button" aria-label=${sed('addWindow')} data-se-add-hwin ?disabled=${this.disabled || h.periods.length >= MAX_PERIODS}
          @click=${() => this.emit(editHoliday(d, i, { periods: [...h.periods, h.periods.length ? { start: h.periods[h.periods.length - 1].end === '24:00' ? '23:00' : h.periods[h.periods.length - 1].end, end: '24:00' } : { start: '08:00', end: '13:00' }] }))}>
          <sw-icon name="plus" size=${16}></sw-icon></button>
        ${this.fault(`${w}.periods`)} ${this.fault(`${w}.start`)} ${this.fault(`${w}.end`)} ${faultAt(this.faults, w) && !faultAt(this.faults, `${w}.start`) && !faultAt(this.faults, `${w}.end`) && !faultAt(this.faults, `${w}.periods`) && !faultAt(this.faults, `${w}.name`) ? this.fault(w) : nothing}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-schedule-draft-form': WkScheduleDraftForm;
  }
}
