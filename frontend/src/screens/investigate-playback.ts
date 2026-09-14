import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-scene';
import '../components/sw-timeline';
import { minuteLabel } from '../components/sw-timeline';
import { demoEvents, demoScene, demoSegments, demoWall } from '../fixtures/catalog';

type Filter = 'all' | 'motion' | 'person' | 'vehicle' | 'door';

/**
 * SC12 — playback & timeline (board 1 screen 7): camera name and time in the header, download / share
 * actions, a large picture with a floating transport bar (pause, ±10s, snapshot, quality, fullscreen),
 * the blue activity timeline with a time bubble, and dot-coloured event filters underneath.
 * Session + generation model, honest precision, gaps stay gaps.
 */
@customElement('investigate-playback')
export class InvestigatePlayback extends LitElement {
  @state() private cameraId = 'cam-10';
  @state() private cursor = 615;
  @state() private generation = 3;
  @state() private playing = true;
  @state() private speed = 1;
  @state() private filter: Filter = 'all';

  static styles = css`
    .pick {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pick sw-field {
      inline-size: 150px;
    }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      color: #fff;
      background: #0f1729;
      box-shadow: var(--sw-shadow-2);
      max-block-size: 62vh;
      margin-inline: auto;
      inline-size: 100%;
    }
    .video sw-scene {
      position: absolute;
      inset: 0;
    }
    .video.gap {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      box-shadow: none;
      border: 1px solid var(--sw-border);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 60%, rgba(0, 0, 0, 0.5) 100%);
      pointer-events: none;
    }
    .tag {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 10px;
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .tag .nm {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
    }
    .video.gap .tag .nm {
      text-shadow: none;
    }
    .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: 10px;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 2px 7px;
    }
    .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 58px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
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
      gap: 6px;
    }
    .bar {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 10px;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
    .bar .inner {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 4px 8px;
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
      padding: 3px 9px;
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
      block-size: 18px;
      background: rgba(255, 255, 255, 0.25);
      margin-inline: 4px;
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters .grow {
      flex: 1;
    }
    .session {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
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
      <sw-page heading=${cam.name} subheading="14.09.2026 ${minuteLabel(this.cursor)} · אזור זמן האתר Asia/Jerusalem · נתוני הדגמה" crumbs="הקלטות | ${cam.floor}" wide>
        <div slot="actions" class="pick">
          <sw-field><select aria-label="מצלמה" @change=${(e: Event) => (this.cameraId = (e.target as HTMLSelectElement).value)}>${demoWall.map((c) => html`<option value=${c.id} ?selected=${c.id === this.cameraId}>${c.name}</option>`)}</select></sw-field>
          <sw-field><input type="date" value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
          <sw-field style="inline-size:96px"><input type="time" value=${minuteLabel(this.cursor)} data-ltr aria-label="שעה" @change=${(e: Event) => { const [h, m] = (e.target as HTMLInputElement).value.split(':').map(Number); this.cursor = h * 60 + m; this.generation += 1; }} /></sw-field>
        </div>
        <sw-button slot="actions" variant="ghost" iconOnly icon="download" label="ייצוא קטע"></sw-button>
        <sw-button slot="actions" variant="ghost" iconOnly icon="link" label="שיתוף"></sw-button>
        <sw-button slot="actions" variant="ghost" iconOnly icon="more" label="עוד"></sw-button>
        <div class="video ${inGap ? 'gap' : ''}">
          ${inGap
            ? html`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live</span></div></div>`
            : html`<sw-scene kind=${demoScene[cam.id] ?? 'lobby'}></sw-scene><div class="shade"></div><span class="demo">דמו · הניגון יתחבר ב־T028</span>`}
          <div class="tag"><sw-badge kind=${inGap ? 'unknown' : 'recorded'} ?onImage=${!inGap}></sw-badge><span class="nm">${cam.name}</span></div>
          <span class="stamp">2026-09-14 ${minuteLabel(this.cursor)}:00 · actual: ${inGap ? '—' : minuteLabel(this.cursor)}</span>
          <div class="bar"><div class="inner">
            <sw-button variant="ghost" size="sm" iconOnly icon=${this.playing ? 'pause' : 'play'} label=${this.playing ? 'השהה' : 'נגן'} @click=${() => (this.playing = !this.playing)}></sw-button>
            <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה"></sw-button>
            <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה"></sw-button>
            <span class="sep"></span>
            ${[1, 2, 4].map((s) => html`<button class="q ${this.speed === s ? 'on' : ''}" @click=${() => (this.speed = s)}>${s}×</button>`)}
            <span class="sep"></span>
            <sw-button variant="ghost" size="sm" iconOnly icon="aperture" label="צילום מהקלטה"></sw-button>
            <button class="q on">1080p</button>
            <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא"></sw-button>
          </div></div>
        </div>
        <sw-timeline .segments=${demoSegments} .events=${events} .cursor=${this.cursor} precision="estimated" @seek=${this.seek}></sw-timeline>
        <div class="filters">
          <sw-chip ?selected=${this.filter === 'all'} @click=${() => (this.filter = 'all')}>הכל</sw-chip>
          <sw-chip dot="#ef4444" ?selected=${this.filter === 'motion'} @click=${() => (this.filter = 'motion')}>תנועה</sw-chip>
          <sw-chip dot="#2f6bff" ?selected=${this.filter === 'person'} @click=${() => (this.filter = 'person')}>אדם</sw-chip>
          <sw-chip dot="#22c55e" ?selected=${this.filter === 'vehicle'} @click=${() => (this.filter = 'vehicle')}>רכב</sw-chip>
          <sw-chip dot="#8b5cf6" ?selected=${this.filter === 'door'} @click=${() => (this.filter = 'door')}>דלת</sw-chip>
          <span class="grow"></span>
          <sw-button size="sm" icon="case">הוסף לתיק</sw-button>
          <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">במפה בזמן הזה</sw-button></a>
        </div>
        <div class="session">
          <span>Session: ${this.playing ? 'playing' : 'paused'} · ${this.speed}×</span>
          <span>דור ${this.generation}</span>
          <span>דיוק זמן: משוער</span>
          <span>כיסוי: ${inGap ? 'פער' : 'מלא'} · 6 מקטעים ביום</span>
          <span>WebRTC → MSE</span>
          ${inGap ? nothing : html`<span>מצלמה: ${cam.name}</span>`}
        </div>
      </sw-page>
    `;
  }
}
