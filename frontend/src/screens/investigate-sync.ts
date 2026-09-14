import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-timeline';
import { demoEvents, demoSegments, demoWall } from '../fixtures/catalog';

/** SC13 — synchronized playback of 2–4 sources (board 2 screen 14, Beta): one master clock, per-source truth. */
@customElement('investigate-sync')
export class InvestigateSync extends LitElement {
  @state() private cursor = 615;

  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sw-s-3);
    }
    .tile {
      position: relative;
    }
    .drift {
      position: absolute;
      inset-inline-end: var(--sw-s-2);
      inset-block-start: var(--sw-s-2);
      z-index: 2;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      direction: ltr;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .bar .grow {
      flex: 1;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    const sources = [
      { cam: demoWall[0], drift: '+0.2s', state: 'recorded' },
      { cam: demoWall[1], drift: '-0.4s', state: 'recorded' },
      { cam: demoWall[3], drift: 'gap', state: 'unknown' },
      { cam: demoWall[4], drift: 'buffering', state: 'stale' },
    ] as const;
    return html`
      <sw-page heading="ניגון מסונכרן" subheading="4 מקורות · שעון ייחוס אחד · הסטייה נמדדת על זמן המדיה המוצגת · נתוני הדגמה" wide>
        <sw-button slot="actions" icon="link">בטל קישור מקור</sw-button>
        <sw-button slot="actions" variant="primary" icon="case">שמור כתיק</sw-button>
        <div class="grid">
          ${sources.map(
            (s) => html`<div class="tile">
              <span class="drift">${s.drift}</span>
              <sw-camera-tile name=${s.cam.name} meta=${s.cam.floor} state=${s.state}></sw-camera-tile>
            </div>`,
          )}
        </div>
        <div class="bar">
          <sw-button variant="primary" iconOnly icon="pause" label="השהה הכל"></sw-button>
          <sw-chip selected>1×</sw-chip><sw-chip>2×</sw-chip>
          <sw-badge kind="stale" label="Best effort: אין מיפוי PTS→UTC מאומת"></sw-badge>
          <span class="grow"></span>
          <sw-chip icon="camera">הוסף מקור</sw-chip>
        </div>
        <sw-timeline .segments=${demoSegments} .events=${demoEvents.slice(0, 4).map((e) => ({ minute: e.minuteOfDay, kind: e.type, label: e.title }))} .cursor=${this.cursor} precision="estimated" @seek=${(e: CustomEvent<{ minute: number }>) => (this.cursor = e.detail.minute)}></sw-timeline>
        <div class="note">מקור שאינו מוכן מוצג במפורש (buffering / gap) ואינו מוצג כמסונכרן. יעד הנדסי: סטייה עד שנייה ב־95% מהדגימות, לאחר בדיקה עם אירוע חזותי משותף.</div>
      </sw-page>
    `;
  }
}
