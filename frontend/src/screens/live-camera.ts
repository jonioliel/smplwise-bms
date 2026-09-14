import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-card';
import '../components/sw-icon';
import { demoWall } from '../fixtures/catalog';

/** SC08 — single camera (board 1 screen 5). Controls appear only for verified capabilities. */
@customElement('live-camera')
export class LiveCamera extends LitElement {
  @property() cameraId = 'cam-1';
  @state() private stream: 'main' | 'sub' = 'main';
  @state() private recording = false;

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
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
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      margin-block-start: var(--sw-s-3);
      align-items: center;
    }
    .controls .grow {
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
      color: var(--sw-text-2);
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
    .ptz {
      display: grid;
      grid-template-columns: repeat(3, 40px);
      gap: 4px;
      justify-content: center;
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
    return html`
      <sw-page heading=${cam.name} subheading=${`${cam.floor} · NVR ערוץ ${cam.id.replace('cam-', '')} · נתוני הדגמה`}>
        <a slot="actions" href="#/investigate/playback"><sw-button icon="history">הקלטות</sw-button></a>
        <a slot="actions" href="#/explore/floors/f0"><sw-button icon="map" variant="ghost">במפה</sw-button></a>
        <div class="layout">
          <div>
            <div class="video">
              <sw-badge class="tag" kind=${cam.state}></sw-badge>
              <div style="text-align:center;display:grid;gap:8px;justify-items:center">
                <sw-icon name=${cam.state === 'offline' ? 'offline' : cam.state === 'forbidden' ? 'lock' : 'camera'} size=${36}></sw-icon>
                <span>${canView ? 'הזרם החי יתחבר דרך go2rtc במשימה T017' : cam.state === 'offline' ? 'המצלמה אינה מחוברת ל־NVR' : 'אין הרשאת צפייה במצלמה זו'}</span>
              </div>
              ${canView ? html`<span class="stamp">2026-09-14 10:24:36 · ${this.stream === 'main' ? '2560×1440' : '640×360'}</span>` : ''}
            </div>
            <div class="controls">
              <sw-button icon="camera" ?disabled=${!canView}>צילום</sw-button>
              <sw-button icon="expand" ?disabled=${!canView}>מסך מלא</sw-button>
              <sw-button variant=${this.stream === 'main' ? 'primary' : 'secondary'} size="sm" @click=${() => (this.stream = 'main')}>HD</sw-button>
              <sw-button variant=${this.stream === 'sub' ? 'primary' : 'secondary'} size="sm" @click=${() => (this.stream = 'sub')}>SD</sw-button>
              <span class="grow"></span>
              ${this.recording ? html`<span class="rec">הקלטה ידנית פעילה · 04:12</span>` : ''}
              <sw-button variant=${this.recording ? 'danger' : 'secondary'} icon=${this.recording ? 'close' : 'play'} ?disabled=${!canView} @click=${() => (this.recording = !this.recording)}>${this.recording ? 'עצור הקלטה' : 'הקלט עכשיו'}</sw-button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--sw-s-4)">
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
            ${cam.ptz
              ? html`<sw-card heading="PTZ (יכולת מאומתת)">
                  <div class="ptz">
                    <span></span><sw-button size="sm" iconOnly icon="chevron" label="למעלה" style="transform:rotate(-90deg)"></sw-button><span></span>
                    <sw-button size="sm" iconOnly icon="chevron" label="שמאלה" flip></sw-button><sw-button size="sm" iconOnly icon="target" label="בית"></sw-button><sw-button size="sm" iconOnly icon="chevron" label="ימינה"></sw-button>
                    <span></span><sw-button size="sm" iconOnly icon="chevron" label="למטה" style="transform:rotate(90deg)"></sw-button><span></span>
                  </div>
                </sw-card>`
              : html`<sw-card heading="פקדים">
                  <div style="font-size:var(--sw-fs-sm);color:var(--sw-text-2)">PTZ, שמע ודיבור אינם מוצגים: היכולת לא אומתה במצלמה זו. פקד שלא נתמך מוסתר או מוסבר, לא מדומה.</div>
                </sw-card>`}
          </div>
        </div>
      </sw-page>
    `;
  }
}
