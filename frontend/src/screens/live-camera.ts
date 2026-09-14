import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-card';
import '../components/sw-icon';
import '../components/sw-chip';
import { demoScene, demoWall } from '../fixtures/catalog';
import { navigate } from '../router';

/**
 * SC08 — single camera (board 1 screen 5): a large picture with name and live pill overlaid, a floating
 * transport bar (±10s, play/pause, snapshot, quality, fullscreen), PTZ joystick with presets / auto-track
 * / patrol for cameras whose capability was verified, and details. Unsupported controls are hidden or
 * explained, never simulated.
 */
@customElement('live-camera')
export class LiveCamera extends LitElement {
  @property() cameraId = 'cam-1';
  @state() private stream: 'main' | 'sub' = 'main';
  @state() private recording = false;
  @state() private playing = true;
  @state() private ptzMode: 'presets' | 'track' | 'patrol' = 'presets';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 2.2fr) minmax(290px, 1fr);
      gap: var(--sw-s-4);
      align-items: start;
    }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: #0f1729;
      color: #fff;
      box-shadow: var(--sw-shadow-2);
    }
    .video.outdoor {
      background: linear-gradient(180deg, #a9c4e6 0%, #cfdff0 34%, #8fa58b 50%, #5f7358 70%, #3f4d3c 100%);
    }
    .video.indoor {
      background: linear-gradient(180deg, #f3ede3 0%, #e4d9c8 40%, #b7a58d 58%, #7d6b57 80%, #4d4235 100%);
    }
    .video.garage {
      background: linear-gradient(180deg, #d9dee6 0%, #b8c0cc 42%, #7f8896 60%, #4b535f 82%, #2f353f 100%);
    }
    .video.night {
      background: linear-gradient(180deg, #1c2a45 0%, #233a63 40%, #172440 60%, #0d1424 100%);
    }
    .video.off {
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
    .video.off::before {
      display: none;
    }
    .overlay {
      position: absolute;
      inset-inline-start: 14px;
      inset-block-start: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 2;
    }
    .overlay .nm {
      font-weight: var(--sw-fw-semibold);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
      font-size: var(--sw-fs-md);
    }
    .demo {
      position: absolute;
      inset-inline-end: 14px;
      inset-block-start: 12px;
      z-index: 2;
      font-size: 10.5px;
      letter-spacing: 0.04em;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 2px 7px;
    }
    .stamp {
      position: absolute;
      inset-inline-end: 14px;
      inset-block-end: 64px;
      z-index: 2;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      color: rgba(255, 255, 255, 0.92);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      font-size: var(--sw-fs-sm);
      gap: 8px;
      z-index: 1;
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
      margin-inline: 4px;
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
    .under {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2);
      margin-block-start: var(--sw-s-3);
    }
    .under .grow {
      flex: 1;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 16px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      font-weight: var(--sw-fw-medium);
    }
    .rec {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-danger);
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .rec::before {
      content: '';
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: blink 1.2s infinite;
    }
    @keyframes blink {
      50% {
        opacity: 0.3;
      }
    }
    .joy {
      position: relative;
      inline-size: 168px;
      block-size: 168px;
      margin: 4px auto 12px;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 45%, #fff 0%, var(--sw-surface-2) 60%, var(--sw-surface-3) 100%);
      border: 1px solid var(--sw-border);
      box-shadow: inset 0 2px 6px rgba(16, 24, 40, 0.06);
    }
    .joy button {
      position: absolute;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    .joy button:hover {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .joy .u {
      inset-block-start: 8px;
      inset-inline-start: calc(50% - 18px);
    }
    .joy .d {
      inset-block-end: 8px;
      inset-inline-start: calc(50% - 18px);
    }
    .joy .l {
      inset-inline-start: 8px;
      inset-block-start: calc(50% - 18px);
    }
    .joy .r {
      inset-inline-end: 8px;
      inset-block-start: calc(50% - 18px);
    }
    .joy .home {
      inset-inline-start: calc(50% - 26px);
      inset-block-start: calc(50% - 26px);
      inline-size: 52px;
      block-size: 52px;
      background: var(--sw-accent);
      color: #fff;
      box-shadow: 0 4px 10px rgba(47, 107, 255, 0.35);
    }
    .joy .home:hover {
      background: var(--sw-accent-hover);
      color: #fff;
    }
    .ptzmodes {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .ptzmodes button {
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      border-radius: var(--sw-r-sm);
      padding: 8px 4px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      display: grid;
      justify-items: center;
      gap: 4px;
      color: var(--sw-text-2);
    }
    .ptzmodes button.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
    }
    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 10px;
    }
    .zoomrow {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-block-start: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    const cam = demoWall.find((c) => c.id === this.cameraId) ?? demoWall[0];
    const canView = cam.state === 'live' || cam.state === 'stale';
    const scene = demoScene[cam.id] ?? 'indoor';
    return html`
      <sw-page heading=${cam.name} subheading=${`${cam.floor} · NVR ערוץ ${cam.id.replace('cam-', '')} · נתוני הדגמה`} wide>
        <a slot="actions" href="#/investigate/playback"><sw-button icon="history">הקלטות</sw-button></a>
        <a slot="actions" href="#/explore/floors/f0"><sw-button icon="map" variant="ghost">במפה</sw-button></a>
        <div class="layout">
          <div>
            <div class="video ${canView ? scene : 'off'}">
              <div class="overlay">
                <sw-badge kind=${cam.state} ?onImage=${canView}></sw-badge>
                ${canView ? html`<span class="nm">${cam.name}</span>` : nothing}
              </div>
              ${canView
                ? html`<span class="demo">דמו · הזרם יתחבר ב־T017</span><span class="stamp">2026-09-14 10:24:36 · ${this.stream === 'main' ? '2560×1440' : '640×360'}</span>`
                : html`<div class="center"><div>
                    <sw-icon name=${cam.state === 'offline' ? 'offline' : 'lock'} size=${36}></sw-icon>
                    <span>${cam.state === 'offline' ? 'המצלמה אינה מחוברת ל־NVR' : 'אין הרשאת צפייה במצלמה זו'}</span>
                  </div></div>`}
              ${canView
                ? html`<div class="bar"><div class="inner">
                    <sw-button variant="ghost" iconOnly icon="back10" label="10 שניות אחורה"></sw-button>
                    <sw-button variant="ghost" iconOnly icon=${this.playing ? 'pause' : 'play'} label=${this.playing ? 'השהה' : 'נגן'} @click=${() => (this.playing = !this.playing)}></sw-button>
                    <sw-button variant="ghost" iconOnly icon="forward10" label="10 שניות קדימה"></sw-button>
                    <span class="sep"></span>
                    <sw-button variant="ghost" iconOnly icon="aperture" label="צילום מסך"></sw-button>
                    ${cam.audio ? html`<sw-button variant="ghost" iconOnly icon="volume" label="שמע"></sw-button>` : nothing}
                    <button class="q ${this.stream === 'main' ? 'on' : ''}" @click=${() => (this.stream = 'main')}>1440p</button>
                    <button class="q ${this.stream === 'sub' ? 'on' : ''}" @click=${() => (this.stream = 'sub')}>360p</button>
                    <sw-button variant="ghost" iconOnly icon="expand" label="מסך מלא"></sw-button>
                  </div></div>`
                : nothing}
            </div>
            <div class="under">
              <sw-chip icon="camera">צילום</sw-chip>
              <sw-chip icon="pin">הצמד לתצוגה</sw-chip>
              <span class="grow"></span>
              ${this.recording ? html`<span class="rec">הקלטה ידנית פעילה · 04:12</span>` : ''}
              <sw-button variant=${this.recording ? 'danger' : 'secondary'} icon=${this.recording ? 'close' : 'play'} ?disabled=${!canView} @click=${() => (this.recording = !this.recording)}>${this.recording ? 'עצור הקלטה' : 'הקלט עכשיו'}</sw-button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--sw-s-4)">
            ${cam.ptz
              ? html`<sw-card heading="בקרת PTZ" subheading="יכולת מאומתת במצלמה זו">
                  <div class="joy" role="group" aria-label="ג׳ויסטיק PTZ">
                    <button class="u" aria-label="למעלה"><sw-icon name="chevronDown" size=${18} style="transform:rotate(180deg)"></sw-icon></button>
                    <button class="d" aria-label="למטה"><sw-icon name="chevronDown" size=${18}></sw-icon></button>
                    <button class="l" aria-label="שמאלה"><sw-icon name="chevron" size=${18} flip></sw-icon></button>
                    <button class="r" aria-label="ימינה"><sw-icon name="chevron" size=${18}></sw-icon></button>
                    <button class="home" aria-label="בית"><sw-icon name="home" size=${22}></sw-icon></button>
                  </div>
                  <div class="zoomrow"><sw-button size="sm" iconOnly icon="minus" label="זום החוצה"></sw-button><span>זום</span><sw-button size="sm" iconOnly icon="plus" label="זום פנימה"></sw-button></div>
                  <div class="ptzmodes" style="margin-block-start:12px">
                    <button class=${this.ptzMode === 'presets' ? 'on' : ''} @click=${() => (this.ptzMode = 'presets')}><sw-icon name="bookmark" size=${16}></sw-icon>Presets</button>
                    <button class=${this.ptzMode === 'track' ? 'on' : ''} @click=${() => (this.ptzMode = 'track')}><sw-icon name="target" size=${16}></sw-icon>מעקב אוטו׳</button>
                    <button class=${this.ptzMode === 'patrol' ? 'on' : ''} @click=${() => (this.ptzMode = 'patrol')}><sw-icon name="route" size=${16}></sw-icon>סיור</button>
                  </div>
                  ${this.ptzMode === 'presets'
                    ? html`<div class="presets"><sw-chip selected>1 · כניסה</sw-chip><sw-chip>2 · חניה</sw-chip><sw-chip>3 · שער</sw-chip><sw-chip icon="plus">שמור</sw-chip></div>`
                    : html`<div class="presets" style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${this.ptzMode === 'track' ? 'מעקב אוטומטי מופעל דרך ה־NVR; מוצג רק אחרי אימות היכולת (T031).' : 'סיור לפי רשימת presets; הרצה דורשת הרשאת מפעיל.'}</div>`}
                </sw-card>`
              : html`<sw-card heading="פקדים">
                  <div style="font-size:var(--sw-fs-sm);color:var(--sw-text-2)">PTZ, שמע ודיבור אינם מוצגים: היכולת לא אומתה במצלמה זו. פקד שלא נתמך מוסתר או מוסבר, לא מדומה.</div>
                </sw-card>`}
            <sw-card heading="פרטים">
              <dl>
                <dt>מצב</dt><dd><sw-badge kind=${cam.state}></sw-badge></dd>
                <dt>הקלטה</dt><dd>${{ continuous: 'רציפה', motion: 'לפי תנועה', off: 'כבויה', unknown: 'לא ידוע' }[cam.recording]}</dd>
                <dt>זרם</dt><dd>${cam.fps ? `${cam.fps} fps · ${cam.bitrateKbps} kbps` : '—'}</dd>
                <dt>קושחה</dt><dd><span class="ltr">${cam.firmware}</span></dd>
                <dt>זמן מקור</dt><dd>NVR · <span class="ltr">Asia/Jerusalem</span></dd>
                <dt>אירוע אחרון</dt><dd>${cam.lastEvent}</dd>
              </dl>
            </sw-card>
            <sw-card heading="מצלמות באותה קומה">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                ${demoWall.filter((c) => c.floor === cam.floor && c.id !== cam.id).slice(0, 4).map((c) => html`<sw-camera-tile compact name=${c.name} state=${c.state} scene=${demoScene[c.id] ?? 'indoor'} @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`)}
              </div>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `;
  }
}
