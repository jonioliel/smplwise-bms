import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-timeline';
import '../components/sw-camera-tile';
import { minuteLabel } from '../components/sw-timeline';
import { demoEvents, demoScene, demoSegments, demoWall } from '../fixtures/catalog';

type Filter = 'all' | 'motion' | 'person' | 'vehicle';

/**
 * SC12 — playback (board 1 screen 7): date, camera and dot-coloured event filters above a large picture,
 * a floating transport bar, and the blue activity timeline with a time bubble. Session + generation
 * model, honest precision, gaps stay gaps.
 */
@customElement('investigate-playback')
export class InvestigatePlayback extends LitElement {
  @state() private cameraId = 'cam-1';
  @state() private cursor = 615;
  @state() private generation = 3;
  @state() private playing = true;
  @state() private speed = 1;
  @state() private filter: Filter = 'all';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: var(--sw-s-4);
      align-items: start;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2);
      margin-block-end: var(--sw-s-3);
    }
    .toolbar sw-field {
      min-inline-size: 150px;
    }
    .toolbar .grow {
      flex: 1;
    }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      color: #fff;
      background: linear-gradient(180deg, #a9c4e6 0%, #cfdff0 34%, #8fa58b 50%, #5f7358 70%, #3f4d3c 100%);
      box-shadow: var(--sw-shadow-2);
    }
    .video.gap {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      box-shadow: none;
      border: 1px solid var(--sw-border);
    }
    .video::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(115deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 40%),
        radial-gradient(120% 90% at 50% 45%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.4) 100%);
      pointer-events: none;
    }
    .video.gap::before {
      display: none;
    }
    .tag {
      position: absolute;
      inset-inline-start: 14px;
      inset-block-start: 12px;
      display: flex;
      gap: 6px;
      z-index: 2;
      align-items: center;
    }
    .tag .nm {
      font-weight: var(--sw-fw-semibold);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
    }
    .video.gap .tag .nm {
      text-shadow: none;
    }
    .demo {
      position: absolute;
      inset-inline-end: 14px;
      inset-block-start: 12px;
      z-index: 2;
      font-size: 10.5px;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 2px 7px;
    }
    .stamp {
      position: absolute;
      inset-inline-end: 14px;
      inset-block-end: 64px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      z-index: 2;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .video.gap .stamp {
      text-shadow: none;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      font-size: var(--sw-fs-sm);
    }
    .center > div {
      display: grid;
      justify-items: center;
      gap: 8px;
    }
    .bar {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 12px;
      display: flex;
      justify-content: center;
      z-index: 3;
      pointer-events: none;
    }
    .bar .inner {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border-radius: var(--sw-r-pill);
      background: rgba(17, 24, 39, 0.72);
      backdrop-filter: blur(8px);
      color: #fff;
      box-shadow: var(--sw-shadow-2);
    }
    .bar sw-button {
      --sw-text-2: #fff;
      --sw-text: #fff;
      --sw-surface-3: rgba(255, 255, 255, 0.14);
    }
    .bar .q {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: var(--sw-r-pill);
      padding: 3px 10px;
      margin-inline: 2px;
      background: transparent;
      color: #fff;
      font-family: inherit;
      cursor: pointer;
    }
    .bar .q.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .bar .sep {
      inline-size: 1px;
      block-size: 20px;
      background: rgba(255, 255, 255, 0.25);
      margin-inline: 4px;
    }
    sw-timeline {
      margin-block-start: var(--sw-s-3);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      margin-block-start: var(--sw-s-3);
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
      max-block-size: 380px;
      overflow: auto;
    }
    .cams button {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-sm);
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
      color: var(--sw-text);
    }
    .cams button:hover {
      background: var(--sw-surface-2);
    }
    .cams button.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
    }
    .cams sw-camera-tile {
      inline-size: 64px;
      flex-shrink: 0;
      pointer-events: none;
    }
    .cams .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .cams .txt small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
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
    const events = demoEvents.filter((e) => e.minuteOfDay < 1440).filter((e) => this.filter === 'all' || e.type === this.filter).map((e) => ({ minute: e.minuteOfDay, kind: e.type, label: e.title }));
    return html`
      <sw-page heading="הקלטות" subheading="${cam.name} · 14.09.2026 · אזור זמן האתר Asia/Jerusalem · נתוני הדגמה" wide>
        <sw-button slot="actions" icon="download">ייצוא קטע</sw-button>
        <a slot="actions" href="#/investigate/playback/sync"><sw-button icon="grid">ניגון מסונכרן</sw-button></a>
        <div class="layout">
          <div>
            <div class="toolbar">
              <sw-field><select @change=${(e: Event) => (this.cameraId = (e.target as HTMLSelectElement).value)}>${demoWall.map((c) => html`<option value=${c.id} ?selected=${c.id === this.cameraId}>${c.name}</option>`)}</select></sw-field>
              <sw-field><input type="date" value="2026-09-14" data-ltr /></sw-field>
              <sw-field><input type="time" value=${minuteLabel(this.cursor)} data-ltr @change=${(e: Event) => { const [h, m] = (e.target as HTMLInputElement).value.split(':').map(Number); this.cursor = h * 60 + m; this.generation += 1; }} /></sw-field>
              <span class="grow"></span>
              <sw-chip ?selected=${this.filter === 'all'} @click=${() => (this.filter = 'all')}>הכל</sw-chip>
              <sw-chip dot="#ef4444" ?selected=${this.filter === 'motion'} @click=${() => (this.filter = 'motion')}>תנועה</sw-chip>
              <sw-chip dot="#2f6bff" ?selected=${this.filter === 'person'} @click=${() => (this.filter = 'person')}>אדם</sw-chip>
              <sw-chip dot="#22c55e" ?selected=${this.filter === 'vehicle'} @click=${() => (this.filter = 'vehicle')}>רכב</sw-chip>
            </div>
            <div class="video ${inGap ? 'gap' : ''}">
              <div class="tag"><sw-badge kind=${inGap ? 'unknown' : 'recorded'} ?onImage=${!inGap}></sw-badge><span class="nm">${cam.name}</span></div>
              ${inGap
                ? html`<div class="center"><div><sw-icon name="offline" size=${36}></sw-icon><span>אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live</span></div></div>`
                : html`<span class="demo">דמו · הניגון יתחבר ב־T028</span>`}
              <span class="stamp">2026-09-14 ${minuteLabel(this.cursor)}:00 · actual: ${inGap ? '—' : minuteLabel(this.cursor)}</span>
              <div class="bar"><div class="inner">
                <sw-button variant="ghost" iconOnly icon="skip" label="קטע קודם" style="transform:scaleX(-1)"></sw-button>
                <sw-button variant="ghost" iconOnly icon="back10" label="10 שניות אחורה"></sw-button>
                <sw-button variant="ghost" iconOnly icon=${this.playing ? 'pause' : 'play'} label=${this.playing ? 'השהה' : 'נגן'} @click=${() => (this.playing = !this.playing)}></sw-button>
                <sw-button variant="ghost" iconOnly icon="forward10" label="10 שניות קדימה"></sw-button>
                <sw-button variant="ghost" iconOnly icon="skip" label="קטע הבא"></sw-button>
                <span class="sep"></span>
                ${[1, 2, 4].map((s) => html`<button class="q ${this.speed === s ? 'on' : ''}" @click=${() => (this.speed = s)}>${s}×</button>`)}
                <span class="sep"></span>
                <sw-button variant="ghost" iconOnly icon="aperture" label="צילום מהקלטה"></sw-button>
                <sw-button variant="ghost" iconOnly icon="expand" label="מסך מלא"></sw-button>
              </div></div>
            </div>
            <sw-timeline .segments=${demoSegments} .events=${events} .cursor=${this.cursor} precision="estimated" @seek=${this.seek}></sw-timeline>
            <div class="actions">
              <sw-button size="sm" icon="case">הוסף לתיק</sw-button>
              <sw-button size="sm" icon="download">ייצוא 10 דק׳ סביב הסמן</sw-button>
              <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">במפה בזמן הזה</sw-button></a>
            </div>
          </div>
          <div class="side">
            <sw-card heading="מצלמות" subheading="בחירה מחליפה session, לא Live">
              <div class="cams">
                ${demoWall.map(
                  (c) => html`<button class=${c.id === this.cameraId ? 'on' : ''} @click=${() => (this.cameraId = c.id)}>
                    <sw-camera-tile compact name="" state=${c.state} scene=${demoScene[c.id] ?? 'indoor'}></sw-camera-tile>
                    <span class="txt">${c.name}<small>${c.floor}</small></span>
                    ${c.state === 'live' ? nothing : html`<sw-badge kind=${c.state}></sw-badge>`}
                  </button>`,
                )}
              </div>
            </sw-card>
            <sw-card heading="Session">
              <dl>
                <dt>מצב</dt><dd>${this.playing ? 'playing' : 'paused'} · ${this.speed}×</dd>
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
