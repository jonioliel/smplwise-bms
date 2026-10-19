import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import type { SettingsDoc, SettingsPatch } from '../api/tickets';
import { ticketSettingsCss } from './settings-styles';
import { calendarOf, calendarPatch, calendarProblem, holidaysText, parseHolidays, sameCalendar, toggleDay, WEEK_ORDER, type WorkCalendar } from './work-calendar-model';
import { wct, type WorkCalendarTextKey } from './work-calendar-text';

/**
 * SLACAL (2.9.1): Settings > the module > general > "שעות עבודה" (system.configure). The installation's working-hours calendar for the
 * stuck / overdue / reminder timers: a switch (OFF = around the clock, exactly the old behaviour), the working days, one daily window, and
 * the holidays (a date per line). The zone is the system's own; per-department hours are a server feature without a screen yet (the
 * overrides stored there are sent back unchanged). Saving goes through the screen's one settings document (`save-doc` {patch}).
 * Light DOM is not used: the card brings the shared settings styles, so it follows the light / dark tokens like its neighbours.
 */
@customElement('tickets-work-calendar-card')
export class TicketsWorkCalendarCard extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) doc: SettingsDoc | null = null;
  @property({ type: Boolean }) busy = false;
  @state() private draft: WorkCalendar | null = null;
  @state() private holidayText: string | null = null;

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .days {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .days button {
      min-block-size: var(--sw-touch-desktop);
      min-inline-size: 56px;
      padding-inline: 12px;
      border: 1px solid var(--dv-border, var(--sw-border-strong));
      border-radius: var(--dv-radius-control, var(--sw-r-sm));
      background: var(--dv-surface-2, var(--sw-surface));
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .days button[aria-pressed='true'] {
      background: var(--sw-accent-soft, var(--sw-surface-2));
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .days button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .times {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    textarea.in {
      inline-size: 100%;
      box-sizing: border-box;
      font-family: var(--sw-font-mono);
      direction: ltr;
      text-align: start;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .field-error {
      color: var(--sw-danger-text, var(--sw-danger));
      font-size: var(--sw-fs-sm);
    }
  `, bubbleChrome];

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('doc')) {
      const prev = changed.get('doc') as SettingsDoc | null | undefined;
      if (!prev || !this.doc || prev.revision !== this.doc.revision) {
        this.draft = null;
        this.holidayText = null;
      }
    }
  }

  private get stored(): WorkCalendar {
    return calendarOf(this.doc?.calendar);
  }

  private get cur(): WorkCalendar {
    return this.draft ?? this.stored;
  }

  private set(p: Partial<WorkCalendar>): void {
    this.draft = { ...this.cur, ...p };
  }

  private save(c: WorkCalendar): void {
    const patch: SettingsPatch = { calendar: calendarPatch(c) };
    this.dispatchEvent(new CustomEvent('save-doc', { detail: { patch }, bubbles: true, composed: true }));
  }

  render() {
    if (!this.doc) return nothing;
    const c = this.cur;
    const typed = this.holidayText ?? holidaysText(c.holidays);
    const parsed = parseHolidays(typed);
    const problem = calendarProblem({ ...c, holidays: parsed.dates });
    const dirty = !sameCalendar({ ...c, holidays: parsed.dates }, this.stored);
    const invalid = !!problem || (c.enabled && parsed.bad.length > 0);
    const overrides = Object.keys(c.departments).length;
    return html`<sw-card heading=${wct('card')} subheading=${wct('cardSub')} data-card="work-calendar">
      <div class="row"><span class="lbl">${wct('enabled')}<span class="muted">${wct('enabledSub')}</span></span>
        <sw-toggle label=${wct('enabled')} labelHidden .checked=${c.enabled} ?disabled=${this.busy} data-wc-enabled
          @change=${(e: CustomEvent<{ checked: boolean }>) => this.set({ enabled: e.detail.checked })}></sw-toggle></div>
      ${c.enabled ? html`
        <div class="row stack"><span class="lbl">${wct('days')}</span>
          <div class="days" role="group" aria-label=${wct('days')}>${WEEK_ORDER.map((d) => html`<button type="button" aria-pressed=${String(c.weekdays.includes(d))} data-wc-day=${d}
            ?disabled=${this.busy} @click=${() => this.set({ weekdays: toggleDay(c.weekdays, d) })}>${wct(`d${d}` as WorkCalendarTextKey)}</button>`)}</div></div>
        <div class="row"><span class="lbl">${wct('hours')}<span class="muted">${wct('hoursSub')}</span></span>
          <span class="times"><input class="in time" type="time" data-wc-time="start" aria-label=${wct('hours')} aria-invalid=${String(problem === 'order' || problem === 'time')} .value=${c.start}
              @input=${(e: Event) => this.set({ start: (e.target as HTMLInputElement).value })} />
            <span class="muted">${wct('to')}</span>
            <input class="in time" type="time" data-wc-time="end" aria-label=${`${wct('hours')} · ${wct('to')}`} aria-invalid=${String(problem === 'order' || problem === 'time')} .value=${c.end}
              @input=${(e: Event) => this.set({ end: (e.target as HTMLInputElement).value })} /></span></div>
        <div class="row stack"><span class="lbl">${wct('holidays')}<span class="muted">${wct('holidaysSub')}</span></span>
          <textarea class="in" rows="4" dir="ltr" data-wc-holidays aria-label=${wct('holidays')} aria-invalid=${String(parsed.bad.length > 0 || problem === 'holidays_many')}
            .value=${typed} @input=${(e: Event) => (this.holidayText = (e.target as HTMLTextAreaElement).value)}></textarea>
          <div class="hint" data-wc-holidays-count>${wct('holidaysCount', { n: parsed.dates.length })}</div></div>` : nothing}
      ${problem ? html`<div class="row"><span class="field-error" role="alert" data-wc-error=${problem}>${wct(`err_${problem}` as WorkCalendarTextKey)}</span></div>` : nothing}
      ${c.enabled && parsed.bad.length ? html`<div class="row"><span class="field-error" role="alert" data-wc-error="bad_dates">${wct('err_bad_dates', { list: parsed.bad.slice(0, 5).join(', ') })}</span></div>` : nothing}
      ${overrides ? html`<div class="row"><span class="hint" data-wc-overrides>${wct('overrides', { n: overrides })}</span></div>` : nothing}
      <div class="row"><span class="hint">${wct('note')}</span></div>
      <div class="foot"><sw-button variant="primary" size="sm" data-wc-save ?disabled=${!dirty || invalid || this.busy}
        @click=${() => this.save({ ...c, holidays: parsed.dates })}>${wct('save')}</sw-button></div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-work-calendar-card': TicketsWorkCalendarCard;
  }
}
