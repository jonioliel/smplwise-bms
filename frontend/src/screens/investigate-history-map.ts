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

/** SC11 — historical map (new:spatial-investigation): frozen timestamp bar, coverage per pin, no physical actions. */
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
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 14px 24px 12px;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .grow {
      flex: 1;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 24px 10px;
      padding: 8px 12px;
      background: var(--sw-recorded-soft);
      border: 1px solid #cddcff;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      flex-wrap: wrap;
    }
    .time {
      font-family: var(--sw-font-mono);
      direction: ltr;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-accent-text);
    }
    input[type='range'] {
      inline-size: 260px;
      direction: ltr;
      accent-color: var(--sw-accent);
    }
    .stage {
      position: relative;
      flex: 1;
      min-block-size: 360px;
      margin: 0 24px 24px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      gap: 12px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 3px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    @media (max-width: 767px) {
      .head,
      .bar {
        margin-inline: 12px;
        padding-inline: 12px;
      }
      .head {
        padding-inline: 0;
      }
      .stage {
        margin: 0;
        border-radius: 0;
      }
      .legend {
        display: none;
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
      <div class="head">
        <div><h1>מפה היסטורית · ${floor.name}</h1><div class="sub">מצב המפה בזמן נבחר · פעולות פיזיות כבויות בחקירה · נתוני הדגמה</div></div>
        <span class="grow"></span>
        <a href="#/explore/floors/${floor.id}"><sw-button icon="live">חזרה ל־Live</sw-button></a>
      </div>
      <div class="bar">
        <sw-badge kind="historic"></sw-badge>
        <span class="time">2026-09-14 ${minuteLabel(this.minute)}</span>
        <input type="range" min="0" max="1439" .value=${String(this.minute)} @input=${(e: Event) => (this.minute = Number((e.target as HTMLInputElement).value))} aria-label="זמן" />
        <sw-chip @click=${() => (this.minute = Math.max(0, this.minute - 60))}>-1 שעה</sw-chip><sw-chip @click=${() => (this.minute = Math.min(1439, this.minute + 60))}>+1 שעה</sw-chip>
        <span class="grow"></span>
        <span style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">גרסת מפה 3 (תקפה מ־01.09)</span>
      </div>
      <div class="stage">
        <sw-plan-canvas .planWidth=${floor.planWidth} .planHeight=${floor.planHeight} .plan=${demoPlan(floor.id)} .markers=${this.markers}></sw-plan-canvas>
        <div class="legend"><span>כחול = יש הקלטה בזמן זה</span><span>מקווקו = לא ידוע / פער</span><span>ישות: מצב ידוע אחרון</span></div>
      </div>
    `;
  }
}
