import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-field';
import '../components/sw-timeline';
import { minuteLabel } from '../components/sw-timeline';
import { demoEvents, demoScene, demoSegments, demoWall } from '../fixtures/catalog';

/** SC13 — command center / synchronized playback (board 2 screen 14, Beta): 2×2 pictures, one transport row, one timeline, per-source truth. */
@customElement('investigate-sync')
export class InvestigateSync extends LitElement {
  @state() private cursor = 615;
  @state() private playing = false;

  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .tile {
      position: relative;
    }
    .drift {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-end: 8px;
      z-index: 2;
      font-family: var(--sw-font-mono);
      font-size: 10px;
      background: rgba(17, 24, 39, 0.6);
      color: #fff;
      padding: 1px 7px;
      border-radius: var(--sw-r-pill);
      direction: ltr;
    }
    .transport {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .transport .grow {
      flex: 1;
    }
    .transport sw-field {
      inline-size: 170px;
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
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
      { cam: demoWall[9], drift: '-0.4s', state: 'recorded' },
      { cam: demoWall[3], drift: 'gap', state: 'unknown' },
      { cam: demoWall[1], drift: 'buffering', state: 'stale' },
    ] as const;
    return html`
      <sw-page heading="מרכז שליטה" subheading="ניטור חי עם ניגון מסונכרן · 4 מקורות · שעון ייחוס אחד · נתוני הדגמה" wide>
        <sw-field slot="actions"><select aria-label="תצוגה"><option>כל המסכים</option><option>כניסה + חצר</option></select></sw-field>
        <sw-button slot="actions" variant="primary" icon="case">שמור כתיק</sw-button>
        <div class="grid">
          ${sources.map(
            (s) => html`<div class="tile">
              <span class="drift">${s.drift}</span>
              <sw-camera-tile name=${s.cam.name} state=${s.state} scene=${demoScene[s.cam.id] ?? 'lobby'}></sw-camera-tile>
            </div>`,
          )}
        </div>
        <div class="transport">
          <sw-field><input type="datetime-local" value=${`2026-09-14T${minuteLabel(this.cursor)}`} data-ltr aria-label="זמן" @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value.split('T')[1] ?? '10:15'; const [h, m] = v.split(':').map(Number); this.cursor = h * 60 + m; }} /></sw-field>
          <sw-button iconOnly icon="mic" label="דיבור"></sw-button>
          <sw-button iconOnly icon="back10" label="אחורה"></sw-button>
          <sw-button variant="primary" iconOnly icon=${this.playing ? 'pause' : 'play'} label=${this.playing ? 'השהה הכל' : 'נגן הכל'} @click=${() => (this.playing = !this.playing)}></sw-button>
          <sw-button iconOnly icon="forward10" label="קדימה"></sw-button>
          <sw-chip selected>1×</sw-chip><sw-chip>2×</sw-chip>
          <span class="grow"></span>
          <sw-badge kind="stale" label="Best effort: אין מיפוי PTS→UTC מאומת"></sw-badge>
          <a href="#/live/wall"><sw-button variant="primary" size="sm" icon="live">Live</sw-button></a>
        </div>
        <sw-timeline .segments=${demoSegments} .events=${demoEvents.slice(0, 4).map((e) => ({ minute: e.minuteOfDay, kind: e.type, label: e.title }))} .cursor=${this.cursor} precision="estimated" @seek=${(e: CustomEvent<{ minute: number }>) => (this.cursor = e.detail.minute)}></sw-timeline>
        <div class="filters">
          <sw-chip selected icon="check">כל המצלמות</sw-chip>
          <sw-chip dot="#ef4444">תנועה</sw-chip><sw-chip dot="#2f6bff">אדם</sw-chip><sw-chip dot="#22c55e">רכב</sw-chip><sw-chip dot="#8b5cf6">אחר</sw-chip>
        </div>
        <div class="note">מקור שאינו מוכן מוצג במפורש (buffering / gap) ואינו מוצג כמסונכרן. יעד הנדסי: סטייה עד שנייה ב־95% מהדגימות, לאחר בדיקה עם אירוע חזותי משותף.</div>
      </sw-page>
    `;
  }
}
