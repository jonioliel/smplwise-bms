import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { ScheduleConditions, ScheduleSlot, Schedule, SunTimes } from '../api/schedules';
import { dayChips, daysWord, slotSegments, type Tone } from '../screens/schedules-logic';

/**
 * CR-014 schedules, the small shared pieces of the list, the drawer and (by tag) S4's editor header:
 *  - `<sw-schedule-bar>`: a schedule's slots on a 24 h axis, 00:00 at the left as in `sw-week-grid` (the time axis is LTR inside
 *    the RTL page), a coloured span per slot, a mark for a point action, the "now" line.
 *  - `<sw-day-chips>`: the seven day chips, Sunday first (at the start side in RTL); `workday` / `weekend` show their word.
 *  - `<schedule-condition-chip>`: the condition badge ("רק בשבת ובחג", "בתנאי: איסור מלאכה פעיל") - docs/architecture/SCHEDULER_API.md §12.3.
 *  - `<sw-schedule-markers>`: the sensitive / "פותח / מנטרל" markers (§5.3).
 */

const TONE_VAR: Record<Tone, string> = {
  light: 'var(--sw-obj-light)',
  switch: 'var(--sw-live)',
  climate: 'var(--sw-accent)',
  cover: 'var(--sw-circuit-6)',
  fan: 'var(--sw-purple)',
  alarm: 'var(--sw-danger)',
  lock: 'var(--sw-danger)',
  door: 'var(--sw-danger)',
  script: 'var(--sw-circuit-2)',
  scene: 'var(--sw-circuit-4)',
  helper: 'var(--sw-live)',
  humidifier: 'var(--sw-accent)',
  vacuum: 'var(--sw-circuit-5)',
  siren: 'var(--sw-danger)',
  media: 'var(--sw-circuit-3)',
  number: 'var(--sw-circuit-1)',
  select: 'var(--sw-circuit-1)',
  off: 'var(--sw-offline)',
  other: 'var(--sw-unknown)',
};

/** The tone's colour as a CSS value (the summary strip's dots use it too). */
export function toneColor(t: Tone): string {
  return TONE_VAR[t];
}

@customElement('sw-schedule-bar')
export class SwScheduleBar extends LitElement {
  @property({ attribute: false }) slots: ScheduleSlot[] = [];
  @property({ attribute: false }) sun: SunTimes | null = null;
  /** Draw the "now" line (today's local time). */
  @property({ type: Boolean }) now = true;
  /** Minutes from midnight for the "now" line; null = the clock. */
  @property({ type: Number }) nowMinutes: number | null = null;
  @property({ type: Boolean, reflect: true }) compact = false;

  static styles = css`
    :host {
      display: block;
      direction: ltr;
      min-inline-size: 0;
    }
    .track {
      position: relative;
      block-size: 14px;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    :host([compact]) .track {
      block-size: 10px;
    }
    .seg {
      position: absolute;
      inset-block: 0;
      background: var(--c);
      border-inline-end: 1px solid var(--sw-surface);
      box-sizing: border-box;
      min-inline-size: 2px;
    }
    .seg.point {
      inset-block: 2px;
      inline-size: 4px;
      min-inline-size: 4px;
      border: 0;
      border-radius: 2px;
    }
    .now {
      position: absolute;
      inset-block: -1px;
      inline-size: 2px;
      margin-inline-start: -1px;
      background: var(--sw-danger);
      border-radius: 1px;
    }
    .axis {
      position: relative;
      block-size: 14px;
      margin-block-start: 3px;
      font-size: var(--sw-fs-2xs);
      line-height: 14px;
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    :host([compact]) .axis {
      display: none;
    }
    .axis span {
      position: absolute;
      transform: translateX(-50%);
    }
    .axis span:first-child {
      transform: none;
    }
    .axis span:last-child {
      transform: translateX(-100%);
    }
  `;

  private minutesNow(): number {
    if (this.nowMinutes !== null) return this.nowMinutes;
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  render() {
    const segs = slotSegments(this.slots, this.sun);
    const now = this.minutesNow();
    return html`
      <div class="track" role="img" aria-label=${segs.map((s) => s.title).join('; ') || 'ללא משבצות'}>
        ${segs.map(
          (s) => html`<i class=${s.point ? 'seg point' : 'seg'} style=${`left:${s.from}%;width:${Math.max(s.to - s.from, 0)}%;--c:${TONE_VAR[s.tone]}`} title=${s.title} data-slot=${s.index}></i>`,
        )}
        ${this.now ? html`<i class="now" style=${`left:${(now / 1440) * 100}%`} data-now></i>` : nothing}
      </div>
      <div class="axis" aria-hidden="true">${[0, 6, 12, 18, 24].map((h) => html`<span style=${`left:${(h / 24) * 100}%`}>${String(h).padStart(2, '0')}</span>`)}</div>
    `;
  }
}

@customElement('sw-day-chips')
export class SwDayChips extends LitElement {
  @property({ attribute: false }) days: Schedule['days'] = { tokens: ['daily'], kind: 'daily', days: [] };
  @property({ type: Boolean, reflect: true }) compact = false;

  static styles = css`
    :host {
      display: inline-flex;
      gap: 3px;
      align-items: center;
    }
    .d {
      display: inline-grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border-radius: 50%;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
      background: transparent;
      border: 1px solid var(--sw-border);
      box-sizing: border-box;
    }
    :host([compact]) .d {
      inline-size: 19px;
      block-size: 19px;
      font-size: var(--sw-fs-2xs);
    }
    .d.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .w {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-accent-text);
      background: var(--sw-accent-soft);
      padding: 2px 9px;
      border-radius: var(--sw-r-pill);
    }
  `;

  render() {
    const word = daysWord(this.days);
    if (word) return html`<span class="w" data-days-word>${word}</span>`;
    return html`${dayChips(this.days).map((d) => html`<span class=${d.on ? 'd on' : 'd'} data-day=${d.id} aria-label=${d.on ? `${d.short} פעיל` : `${d.short} לא פעיל`}>${d.short}</span>`)}`;
  }
}

@customElement('schedule-condition-chip')
export class ScheduleConditionChip extends LitElement {
  @property({ attribute: false }) conditions: ScheduleConditions | null = null;
  @property({ type: Boolean, reflect: true }) compact = false;

  static styles = css`
    :host {
      display: inline-flex;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    :host([hidden]) {
      display: none;
    }
    span.chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 9px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 16px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    span.chip.preset {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    span.txt {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host([compact]) span.chip {
      padding: 1px 7px;
    }
  `;

  render() {
    const c = this.conditions;
    if (!c || !c.items.length) return nothing;
    const text = c.summary ?? 'בתנאי';
    return html`<span class=${c.preset ? 'chip preset' : 'chip'} data-condition-chip=${c.preset ?? 'custom'} title=${text}><sw-icon name=${c.preset ? 'calendar' : 'sensor'} size=${12}></sw-icon><span class="txt">${text}</span></span>`;
  }
}

@customElement('sw-schedule-markers')
export class SwScheduleMarkers extends LitElement {
  @property({ type: Boolean }) sensitive = false;
  @property({ type: Boolean }) lowering = false;

  static styles = css`
    :host {
      display: inline-flex;
      gap: 5px;
      flex-wrap: wrap;
    }
    span.m {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 16px;
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    span.m.sens {
      background: var(--sw-stale-soft);
      color: var(--sw-warning-text);
    }
  `;

  render() {
    return html`${this.sensitive ? html`<span class="m sens" data-marker="sensitive"><sw-icon name="shield" size=${12}></sw-icon>רגיש</span>` : nothing}${this.lowering
      ? html`<span class="m" data-marker="lowering"><sw-icon name="unlock" size=${12}></sw-icon>פותח / מנטרל</span>`
      : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-schedule-bar': SwScheduleBar;
    'sw-day-chips': SwDayChips;
    'schedule-condition-chip': ScheduleConditionChip;
    'sw-schedule-markers': SwScheduleMarkers;
  }
}
