import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-timeline';
import { minuteLabel } from '../components/sw-timeline';
import { demoEvents, demoSegments, demoWall } from '../fixtures/catalog';

/** SC12 — playback / timeline (board 1 screen 7). Session + generation model, honest precision. */
@customElement('investigate-playback')
export class InvestigatePlayback extends LitElement {
  @state() private cameraId = 'cam-1';
  @state() private cursor = 615;
  @state() private generation = 3;
  @state() private playing = true;

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: var(--sw-s-4);
      align-items: start;
    }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      background: var(--sw-video-bg);
      border-radius: var(--sw-r-lg);
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.75);
      overflow: hidden;
    }
    .video .tag {
      position: absolute;
      inset-inline-start: var(--sw-s-3);
      inset-block-start: var(--sw-s-3);
      display: flex;
      gap: 6px;
    }
    .video .stamp {
      position: absolute;
      inset-inline-end: var(--sw-s-3);
      inset-block-end: var(--sw-s-3);
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      background: rgba(0, 0, 0, 0.45);
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
    }
    .transport {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      margin-block: var(--sw-s-3);
      flex-wrap: wrap;
    }
    .transport .grow {
      flex: 1;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .cams {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 260px;
      overflow: auto;
    }
    .cams button {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-sm);
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
      color: var(--sw-text);
    }
    .cams button.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-2);
    }
    dd {
      margin: 0;
    }
    .types {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;

  private seek(e: CustomEvent<{ minute: number }>) {
    this.cursor = e.detail.minute;
    this.generation += 1;
  }

  render() {
    const cam = demoWall.find((c) => c.id === this.cameraId) ?? demoWall[0];
    const inGap = !demoSegments.some((s) => this.cursor >= s.startMin && this.cursor <= s.endMin);
    return html`
      <sw-page heading="הקלטות" subheading="${cam.name} · 14.09.2026 · אזור זמן האתר Asia/Jerusalem · נתוני הדגמה" wide>
        <sw-button slot="actions" icon="download">ייצוא קטע</sw-button>
        <a slot="actions" href="#/investigate/playback/sync"><sw-button icon="layers">ניגון מסונכרן</sw-button></a>
        <div class="layout">
          <div>
            <div class="video">
              <div class="tag"><sw-badge kind=${inGap ? 'unknown' : 'recorded'}></sw-badge><sw-badge kind="neutral" label=${`Seek #${this.generation}`}></sw-badge></div>
              <div style="text-align:center;display:grid;gap:8px;justify-items:center">
                <sw-icon name=${inGap ? 'offline' : 'history'} size=${36}></sw-icon>
                <span>${inGap ? 'אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live' : 'הניגון יתחבר ל־go2rtc session במשימה T028'}</span>
              </div>
              <span class="stamp">2026-09-14 ${minuteLabel(this.cursor)}:00 · actual: ${inGap ? '—' : minuteLabel(this.cursor)}</span>
            </div>
            <div class="transport">
              <sw-button iconOnly icon="skip" label="קטע קודם" style="transform:scaleX(-1)"></sw-button>
              <sw-button variant="primary" iconOnly icon=${this.playing ? 'pause' : 'play'} label=${this.playing ? 'השהה' : 'נגן'} @click=${() => (this.playing = !this.playing)}></sw-button>
              <sw-button iconOnly icon="skip" label="קטע הבא"></sw-button>
              <sw-chip selected>1×</sw-chip><sw-chip>2×</sw-chip><sw-chip>4×</sw-chip>
              <span class="grow"></span>
              <sw-button size="sm" icon="camera">צילום מהקלטה</sw-button>
              <sw-button size="sm" icon="case">הוסף לתיק</sw-button>
              <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">במפה בזמן הזה</sw-button></a>
            </div>
            <sw-timeline .segments=${demoSegments} .events=${demoEvents.filter((e) => e.minuteOfDay < 1440).map((e) => ({ minute: e.minuteOfDay, kind: e.type, label: e.title }))} .cursor=${this.cursor} precision="estimated" @seek=${this.seek}></sw-timeline>
          </div>
          <div class="side">
            <sw-card heading="תאריך וזמן">
              <sw-field label="תאריך"><input type="date" value="2026-09-14" data-ltr /></sw-field>
              <sw-field label="שעה (זמן האתר)"><input type="time" value=${minuteLabel(this.cursor)} data-ltr @change=${(e: Event) => { const [h, m] = (e.target as HTMLInputElement).value.split(':').map(Number); this.cursor = h * 60 + m; this.generation += 1; }} /></sw-field>
              <div class="types" style="margin-block-start:8px"><sw-chip selected>הכל</sw-chip><sw-chip>תנועה</sw-chip><sw-chip>אדם</sw-chip><sw-chip>רכב</sw-chip></div>
            </sw-card>
            <sw-card heading="מצלמה">
              <div class="cams">${demoWall.map((c) => html`<button class=${c.id === this.cameraId ? 'on' : ''} @click=${() => (this.cameraId = c.id)}><span>${c.name}</span><sw-badge kind=${c.state}></sw-badge></button>`)}</div>
            </sw-card>
            <sw-card heading="Session">
              <dl>
                <dt>מצב</dt><dd>${this.playing ? 'playing' : 'paused'}</dd>
                <dt>דור (generation)</dt><dd>${this.generation}</dd>
                <dt>דיוק זמן</dt><dd><sw-badge kind="stale" label="משוער"></sw-badge></dd>
                <dt>כיסוי</dt><dd>${inGap ? 'פער' : 'מלא'} · 6 מקטעים ביום</dd>
                <dt>תחבורה</dt><dd>WebRTC → MSE</dd>
              </dl>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `;
  }
}
