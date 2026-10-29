import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { ticketsApi, type SettingsDoc, type SettingsPatch } from '../api/tickets';
import { ticketSettingsCss } from './settings-styles';
import {
  AUTO_CLOSE_MODES, calendarOf, calendarPatch, calendarProblem, deptMode, deptSpec, holidaysText, LINK_CLOCK_MODES, parseHolidays, sameCalendar, setDailyWindow,
  setDayWindow, setDeptMode, setDeptSpec, specProblem, toggleDay, WEEK_ORDER, windowOf, type DeptMode, type HoursSpec, type WorkCalendar,
} from './work-calendar-model';
import { wct, type WorkCalendarTextKey } from './work-calendar-text';
import { dateInputLang } from '../api/day-format';

const DEPT_MODES: readonly DeptMode[] = ['inherit', 'always', 'own'];

/**
 * SLACAL (2.9.1): Settings > the module > general > "שעות עבודה" (system.configure). The installation's working-hours calendar for the
 * stuck / overdue / reminder timers: a switch (OFF = around the clock, exactly the old behaviour), the working days, the daily window and
 * optional hours for single weekdays (a short Friday), the holidays (a date per line), whether internal reminders wait for the opening, how
 * the automatic close and the "vendor link not opened" threshold count, and - per department - "like the general setting", "around the
 * clock" or its own hours. The zone is the system's own. Saving goes through the screen's one settings document (`save-doc` {patch}).
 */
@customElement('tickets-work-calendar-card')
export class TicketsWorkCalendarCard extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) doc: SettingsDoc | null = null;
  @property({ type: Boolean }) busy = false;
  @state() private draft: WorkCalendar | null = null;
  @state() private holidayText: string | null = null;
  @state() private departments: { id: string; name: string }[] = [];

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
      background: var(--sw-accent-soft);
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
    .dayrow {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-block-size: 44px;
    }
    .dayrow .dn {
      min-inline-size: 64px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .nested {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding-inline-start: 16px;
      border-inline-start: 2px solid var(--dv-border, var(--sw-border));
    }
    /* GATE-FIX-2270: a department's mode row already sits inside the departments well (R5-SYSTEM-297 made every .row a well):
       no second well around it, and its three keys (now 16/600) move under the department's name when the row is too narrow,
       instead of being cut (320 px) or leaving the well (1024 px) */
    .nested .row {
      flex-wrap: wrap;
      padding-inline: 0;
      background: transparent;
    }
    @media (max-width: 767px) {
      .nested {
        padding-inline-start: 10px;
      }
      .nested .seg button {
        padding-inline: 8px;
      }
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
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
  `, bubbleChrome];

  connectedCallback(): void {
    super.connectedCallback();
    void ticketsApi().departments().then((r) => (this.departments = r.departments.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name }))))
      .catch(() => undefined);
  }

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

  /** The hours editor shared by the installation and an own-hours department: working days, the daily window, and one row per working day. */
  private editor(spec: HoursSpec, change: (s: HoursSpec) => void, tag: string): TemplateResult {
    const bad = specProblem(spec);
    const time = (value: string, aria: string, on: (v: string) => void, attr: string) => html`<input class="in time" type="time" lang=${dateInputLang()} data-wc-time=${attr} aria-label=${aria}
      aria-invalid=${String(bad === 'order' || bad === 'time')} .value=${value} @input=${(e: Event) => on((e.target as HTMLInputElement).value)} />`;
    return html`
      <div class="row stack"><span class="lbl">${wct('days')}</span>
        <div class="days" role="group" aria-label=${wct('days')}>${WEEK_ORDER.map((d) => html`<button type="button" aria-pressed=${String(spec.weekdays.includes(d))} data-wc-day=${`${tag}${d}`}
          ?disabled=${this.busy} @click=${() => change({ ...spec, weekdays: toggleDay(spec.weekdays, d) })}>${wct(`d${d}` as WorkCalendarTextKey)}</button>`)}</div></div>
      <div class="row"><span class="lbl">${wct('hours')}<span class="muted">${wct('hoursSub')}</span></span>
        <span class="times">${time(spec.start, wct('hours'), (v) => change(setDailyWindow(spec, v, spec.end)), `${tag}start`)}
          <span class="muted">${wct('to')}</span>
          ${time(spec.end, `${wct('hours')} · ${wct('to')}`, (v) => change(setDailyWindow(spec, spec.start, v)), `${tag}end`)}</span></div>
      <div class="row stack"><span class="lbl">${wct('dayHours')}<span class="muted">${wct('dayHoursSub')}</span></span>
        ${WEEK_ORDER.filter((d) => spec.weekdays.includes(d)).map((d) => {
          const w = windowOf(spec, d);
          return html`<div class="dayrow" data-wc-dayrow=${`${tag}${d}`}><span class="dn">${wct(`d${d}` as WorkCalendarTextKey)}</span>
            ${time(w.start, `${wct(`d${d}` as WorkCalendarTextKey)}`, (v) => change(setDayWindow(spec, d, v, w.end)), `${tag}d${d}start`)}
            <span class="muted">${wct('to')}</span>
            ${time(w.end, `${wct(`d${d}` as WorkCalendarTextKey)} · ${wct('to')}`, (v) => change(setDayWindow(spec, d, w.start, v)), `${tag}d${d}end`)}</div>`;
        })}</div>`;
  }

  private seg<T extends string>(label: string, sub: string, attr: string, values: readonly T[], cur: T, text: (v: T) => string, on: (v: T) => void): TemplateResult {
    return html`<div class="row"><span class="lbl">${label}<span class="muted">${sub}</span></span>
      <span class="seg" role="radiogroup" aria-label=${label}>${values.map((v) => html`<button type="button" role="radio" aria-pressed=${String(cur === v)} aria-checked=${String(cur === v)}
        data-wc-seg=${`${attr}:${v}`} ?disabled=${this.busy} @click=${() => on(v)}>${text(v)}</button>`)}</span></div>`;
  }

  private deptRows(c: WorkCalendar): TemplateResult | typeof nothing {
    if (!this.departments.length) return nothing;
    return html`<div class="row stack"><span class="lbl">${wct('depts')}<span class="muted">${wct('deptsSub')}</span></span>
      ${this.departments.map((d) => {
        const mode = deptMode(c.departments[d.id]);
        return html`<div class="nested" data-wc-dept=${d.id}>
          ${this.seg(d.name, '', `dept-${d.id}`, DEPT_MODES, mode, (m) => wct(`dm_${m}` as WorkCalendarTextKey), (m) => this.set({ departments: setDeptMode(c, d.id, m) }))}
          ${mode === 'own' ? this.editor(deptSpec(c, d.id), (s) => this.set({ departments: setDeptSpec(c, d.id, s) }), `dept-${d.id}-`) : nothing}
        </div>`;
      })}</div>`;
  }

  render() {
    if (!this.doc) return nothing;
    const c = this.cur;
    const typed = this.holidayText ?? holidaysText(c.holidays);
    const parsed = parseHolidays(typed);
    const next: WorkCalendar = { ...c, holidays: parsed.dates };
    const problem = calendarProblem(next);
    const dirty = !sameCalendar(next, this.stored);
    const invalid = !!problem || (c.enabled && parsed.bad.length > 0);
    return html`<sw-card heading=${wct('card')} subheading=${wct('cardSub')} data-card="work-calendar">
      <div class="row"><span class="lbl">${wct('enabled')}<span class="muted">${wct('enabledSub')}</span></span>
        <sw-toggle label=${wct('enabled')} labelHidden .checked=${c.enabled} ?disabled=${this.busy} data-wc-enabled
          @change=${(e: CustomEvent<{ checked: boolean }>) => this.set({ enabled: e.detail.checked })}></sw-toggle></div>
      ${c.enabled ? html`
        ${this.editor(c, (s) => this.set({ weekdays: s.weekdays, start: s.start, end: s.end, days: s.days }), '')}
        <div class="row stack"><span class="lbl">${wct('holidays')}<span class="muted">${wct('holidaysSub')}</span></span>
          <textarea class="in" rows="4" dir="ltr" data-wc-holidays aria-label=${wct('holidays')} aria-invalid=${String(parsed.bad.length > 0 || problem === 'holidays_many')}
            .value=${typed} @input=${(e: Event) => (this.holidayText = (e.target as HTMLTextAreaElement).value)}></textarea>
          <div class="hint" data-wc-holidays-count>${wct('holidaysCount', { n: parsed.dates.length })}</div></div>
        <div class="row"><span class="lbl">${wct('holdInternal')}<span class="muted">${wct('holdInternalSub')}</span></span>
          <sw-toggle label=${wct('holdInternal')} labelHidden .checked=${c.hold_internal} ?disabled=${this.busy} data-wc-hold
            @change=${(e: CustomEvent<{ checked: boolean }>) => this.set({ hold_internal: e.detail.checked })}></sw-toggle></div>
        ${this.seg(wct('autoClose'), wct('autoCloseSub'), 'auto_close', AUTO_CLOSE_MODES, c.auto_close, (v) => wct(v === 'working' ? 'ac_working' : 'ac_calendar'), (v) => this.set({ auto_close: v }))}
        ${this.seg(wct('linkClock'), wct('linkClockSub'), 'link_unopened', LINK_CLOCK_MODES, c.link_unopened, (v) => wct(v === 'working' ? 'lc_working' : 'lc_wall'), (v) => this.set({ link_unopened: v }))}` : nothing}
      ${this.deptRows(c)}
      ${problem ? html`<div class="row"><span class="field-error" role="alert" data-wc-error=${problem}>${wct(`err_${problem}` as WorkCalendarTextKey)}</span></div>` : nothing}
      ${c.enabled && parsed.bad.length ? html`<div class="row"><span class="field-error" role="alert" data-wc-error="bad_dates">${wct('err_bad_dates', { list: parsed.bad.slice(0, 5).join(', ') })}</span></div>` : nothing}
      <div class="row"><span class="hint">${wct('note')}</span></div>
      <div class="foot"><sw-button variant="primary" size="sm" data-wc-save ?disabled=${!dirty || invalid || this.busy}
        @click=${() => this.save(next)}>${wct('save')}</sw-button></div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-work-calendar-card': TicketsWorkCalendarCard;
  }
}
