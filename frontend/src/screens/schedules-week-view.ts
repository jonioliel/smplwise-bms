import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { DAY_LONG, DAY_ORDER, SUN_FALLBACK, actionLabel, timeMinutes, type DayId, type Schedule, type SunTimes } from '../api/schedules';
import { CATEGORY_LABEL, clock, minutesToPercent, slotCategory, type SlotCategory } from './schedule-grid-logic';

/**
 * CR-014 S4: the list's week view (mockup 03): every enabled schedule of the shown set composed on one 7 x 24 h board - read
 * only. Each pill marks the moment a slot RUNS (its start), not a duration; a press opens the schedule. Days that a schedule
 * resolves to (`daily`, explicit days) are drawn; `workday` / `weekend` cannot be resolved (P0-1) and appear on no day.
 *
 * `<schedules-week-view .schedules .sun .snap @open-schedule={id}>`   (rendered by S3's list for `view=week`)
 */

interface Pill {
  id: string;
  key: string;
  at: number;
  text: string;
  title: string;
  cat: SlotCategory;
  cond: boolean;
  lane: number;
  w: number;
  /** Left edge in pixels inside the track. */
  x: number;
}

export class SchedulesWeekView extends LitElement {
  @property({ attribute: false }) schedules: Schedule[] = [];
  @property({ attribute: false }) sun: SunTimes | null = null;
  /** Kept for the shared vocabulary of the grid (the week view does not edit). */
  @property({ type: Number }) snap = 15;
  @state() private width = 0;
  private ro: ResizeObserver | null = null;

  static styles = css`
    :host {
      display: block;
      direction: ltr;
      font-size: var(--sw-fs-xs);
      --sc-on: #16a34a;
      --sc-off: #64748b;
      --sc-level: #d97706;
      --sc-climate: #2767ed;
      --sc-cover: #0d9488;
      --sc-secure: #7c3aed;
      --sc-custom: #475569;
      --sc-empty: #94a3b8;
      --label-w: 64px;
    }
    .head {
      position: relative;
      block-size: 24px;
      margin-inline-end: var(--label-w);
    }
    .hour {
      position: absolute;
      inset-block-end: 2px;
      transform: translateX(-50%);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-2xs);
      font-variant-numeric: tabular-nums;
    }
    .hour:first-child {
      transform: none;
    }
    .rows {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr var(--label-w);
    }
    .lbl {
      direction: rtl;
      padding-inline-start: 8px;
      display: flex;
      align-items: center;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .row.today .lbl {
      color: var(--sw-accent-text);
    }
    .track {
      position: relative;
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      min-block-size: 40px;
    }
    .night {
      position: absolute;
      inset-block: 0;
      background: rgba(30, 46, 71, 0.045);
    }
    .gl {
      position: absolute;
      inset-block: 0;
      inline-size: 1px;
      background: rgba(30, 46, 71, 0.07);
    }
    .sunl {
      position: absolute;
      inset-block: 0;
      border-inline-start: 1px dashed rgba(217, 119, 6, 0.7);
    }
    .nowl {
      position: absolute;
      inset-block: 0;
      border-inline-start: 2px solid var(--sw-danger);
      z-index: 2;
    }
    .pill {
      --c: var(--sc-custom);
      position: absolute;
      block-size: 18px;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 0 7px;
      border-radius: var(--sw-r-xs);
      border: 1px solid var(--c);
      border-inline-start-width: 3px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-2xs);
      cursor: pointer;
      white-space: nowrap;
      direction: rtl;
      z-index: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pill:hover,
    .pill:focus-visible {
      z-index: 3;
      box-shadow: var(--sw-shadow-2);
      outline: 2px solid var(--sw-focus);
    }
    .pill.cond {
      border-style: dashed;
      border-inline-start-style: solid;
    }
    .pill b {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      font-weight: var(--sw-fw-semibold);
    }
    .pill.c-on {
      --c: var(--sc-on);
    }
    .pill.c-off {
      --c: var(--sc-off);
    }
    .pill.c-level {
      --c: var(--sc-level);
    }
    .pill.c-climate {
      --c: var(--sc-climate);
    }
    .pill.c-cover {
      --c: var(--sc-cover);
    }
    .pill.c-secure {
      --c: var(--sc-secure);
    }
    .empty {
      padding: 24px;
      text-align: center;
      color: var(--sw-text-3);
      direction: rtl;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.ro = new ResizeObserver(() => {
      const t = this.renderRoot.querySelector<HTMLElement>('.track');
      if (t && Math.abs(t.clientWidth - this.width) > 2) this.width = t.clientWidth;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.ro = null;
  }

  protected firstUpdated() {
    this.ro?.observe(this);
    const t = this.renderRoot.querySelector<HTMLElement>('.track');
    if (t) this.width = t.clientWidth;
  }

  /** The pills of one day, laid out in lanes so that no two overlap in pixels. */
  private pillsOf(day: DayId): Pill[] {
    const sun = this.sun ?? SUN_FALLBACK;
    const raw: Omit<Pill, 'lane' | 'w' | 'x'>[] = [];
    for (const s of this.schedules) {
      if (!s.enabled) continue;
      const days = s.days.days;
      if (!days || !days.includes(day)) continue;
      const classOf = (id: string | null) => s.entities.find((e) => e.entity_id === id)?.class ?? null;
      s.slots.forEach((sl, i) => {
        const at = timeMinutes(sl.start, sun);
        const cat = slotCategory({ start: sl.start.raw, stop: sl.stop?.raw ?? null, actions: sl.actions.map((a) => ({ service: a.service, entity_id: a.entity_id, data: a.data })) }, classOf);
        const what = sl.actions[0] ? actionLabel(sl.actions[0]) : '';
        raw.push({ id: s.id, key: `${s.id}:${i}`, at, text: s.display_name, title: `${clock(at)} · ${s.display_name}${what ? ` · ${what}` : ''} (${CATEGORY_LABEL[cat]})${s.conditions.items.length ? ' · בתנאי' : ''}`, cat, cond: s.conditions.items.length > 0 });
      });
    }
    raw.sort((a, b) => a.at - b.at);
    const W = Math.max(this.width, 300);
    const laneEnd: number[] = [];
    return raw.map((p) => {
      const w = Math.min(240, 62 + p.text.length * 6.6);
      // a pill near the end of the day is pulled inside the track BEFORE it is placed in a lane, so the lanes hold true
      const x = Math.max(0, Math.min((p.at / 1440) * W, W - w - 2));
      let lane = laneEnd.findIndex((end) => end + 4 <= x);
      if (lane < 0) {
        lane = laneEnd.length;
        laneEnd.push(0);
      }
      laneEnd[lane] = x + w;
      return { ...p, lane, w, x };
    });
  }

  private openSchedule(id: string) {
    this.dispatchEvent(new CustomEvent('open-schedule', { detail: { id }, bubbles: true, composed: true }));
  }

  render() {
    const sun = this.sun ?? SUN_FALLBACK;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const today = DAY_ORDER[now.getDay()];
    return html`<div data-week-view>
      <div class="head" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => i * 3).map((h) => html`<span class="hour" style="left:${minutesToPercent(h * 60)}%">${String(h).padStart(2, '0')}</span>`)}</div>
      <div class="rows">
        ${DAY_ORDER.map((d) => {
          const pills = this.pillsOf(d);
          const lanes = pills.reduce((m, p) => Math.max(m, p.lane + 1), 0);
          return html`<div class="row ${d === today ? 'today' : ''}" data-week-day=${d}>
            <div class="track" style="min-block-size:${Math.max(40, 8 + lanes * 21)}px">
              <div class="night" style="left:0;width:${minutesToPercent(sun.sunrise)}%"></div>
              <div class="night" style="left:${minutesToPercent(sun.sunset)}%;width:${100 - minutesToPercent(sun.sunset)}%"></div>
              ${[3, 6, 9, 12, 15, 18, 21].map((h) => html`<div class="gl" style="left:${minutesToPercent(h * 60)}%"></div>`)}
              <div class="sunl" style="left:${minutesToPercent(sun.sunrise)}%"></div>
              <div class="sunl" style="left:${minutesToPercent(sun.sunset)}%"></div>
              ${d === today ? html`<div class="nowl" style="left:${minutesToPercent(nowMin)}%"></div>` : nothing}
              ${pills.map((p) => {
                return html`<button type="button" class="pill c-${p.cat} ${p.cond ? 'cond' : ''}" style="left:${p.x}px;top:${4 + p.lane * 21}px;max-inline-size:${p.w}px" title=${p.title} data-week-pill=${p.id} @click=${() => this.openSchedule(p.id)}><b>${clock(p.at)}</b><span>${p.text}</span></button>`;
              })}
            </div>
            <div class="lbl">${DAY_LONG[d]}</div>
          </div>`;
        })}
      </div>
      ${this.schedules.some((s) => s.enabled) ? nothing : html`<div class="empty">אין תזמונים פעילים להצגה.</div>`}
    </div>`;
  }
}

// Registered once and only if the tag is free (S3's list spec stands its own double in first; the product never does).
if (!customElements.get('schedules-week-view')) customElements.define('schedules-week-view', SchedulesWeekView);

declare global {
  interface HTMLElementTagNameMap {
    'schedules-week-view': SchedulesWeekView;
  }
}
