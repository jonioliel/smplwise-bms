import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-icon';
import '../components/sw-field';
import '../map/sw-plan-canvas';
import type { PlanMarker } from '../map/sw-plan-canvas';
import { demoCameras, demoEntities, demoFloors, demoPlan } from '../fixtures/demo';
import { minuteLabel } from '../components/sw-timeline';

/** SC11 — historical map (new:spatial-investigation): frozen timestamp, coverage, no physical actions. */
@customElement('investigate-history-map')
export class InvestigateHistoryMap extends LitElement {
  @property() floorId = 'f0';
  @state() private minute = 615;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      block-size: 100%;
      min-block-size: 0;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-3);
      padding: var(--sw-s-3) var(--sw-s-4);
      background: var(--sw-recorded-soft);
      border-block-end: 1px solid var(--sw-border);
    }
    .bar strong {
      font-size: var(--sw-fs-lg);
    }
    .time {
      font-family: var(--sw-font-mono);
      direction: ltr;
      font-weight: var(--sw-fw-semibold);
    }
    .bar .grow {
      flex: 1;
    }
    .stage {
      position: relative;
      flex: 1;
      min-block-size: 360px;
      margin: var(--sw-s-4);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      overflow: hidden;
    }
    .legend {
      position: absolute;
      inset-inline-start: var(--sw-s-3);
      inset-block-start: var(--sw-s-3);
      z-index: var(--sw-z-map-ui);
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: var(--sw-s-2) var(--sw-s-3);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    input[type='range'] {
      inline-size: 260px;
      direction: ltr;
    }
    @media (max-width: 767px) {
      .stage {
        margin: 0;
        border-radius: 0;
      }
    }
  `;

  private get markers(): PlanMarker[] {
    // Historical rendering: camera markers show coverage at the chosen minute; entities show
    // the last known state before that minute or "unknown" when history is missing.
    const covered = (id: string) => (id === 'cam-3' ? 'unknown' : this.minute >= 190 && this.minute <= 205 ? 'unknown' : 'historic');
    const cams: PlanMarker[] = demoCameras.filter((c) => c.floorId === this.floorId).map((c) => ({ id: c.id, kind: 'camera', label: c.name, x: c.x, y: c.y, rotation: c.rotation, fov: c.fov, state: c.state === 'forbidden' ? 'forbidden' : covered(c.id) }));
    const ents: PlanMarker[] = demoEntities.filter((e) => e.floorId === this.floorId).map((e, i) => ({ id: e.id, kind: e.domain, label: e.name, x: e.x, y: e.y, state: i % 2 ? 'unknown' : 'historic' }));
    return [...cams, ...ents];
  }

  render() {
    const floor = demoFloors.find((f) => f.id === this.floorId) ?? demoFloors[0];
    return html`
      <div class="bar">
        <sw-badge kind="historic"></sw-badge>
        <strong>${floor.name}</strong>
        <span class="time">2026-09-14 ${minuteLabel(this.minute)}</span>
        <input type="range" min="0" max="1439" .value=${String(this.minute)} @input=${(e: Event) => (this.minute = Number((e.target as HTMLInputElement).value))} aria-label="זמן" />
        <sw-chip>-1 שעה</sw-chip><sw-chip>+1 שעה</sw-chip>
        <span class="grow"></span>
        <a href="#/explore/floors/${floor.id}"><sw-button icon="live">חזרה ל־Live</sw-button></a>
      </div>
      <div class="stage">
        <div class="legend">
          <span>מוצג: גרסת מפה 3 (תקפה מ־01.09) · נתוני הדגמה</span>
          <span>מצלמה: כחול = יש הקלטה בזמן זה · מקווקו = לא ידוע / פער</span>
          <span>ישות: מצב ידוע אחרון או "לא ידוע"; פעולות פיזיות כבויות בחקירה</span>
        </div>
        <sw-plan-canvas .planWidth=${floor.planWidth} .planHeight=${floor.planHeight} .plan=${demoPlan(floor.id)} .markers=${this.markers}></sw-plan-canvas>
      </div>
    `;
  }
}
