import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-card';
import '../components/sw-icon';
import '../components/sw-chip';
import '../components/sw-scene';
import { demoScene, demoWall } from '../fixtures/catalog';
import { navigate } from '../router';

/**
 * SC08 — live camera view (board 1 screen 5): back arrow, name and live pill in the header, a large
 * picture with timestamp and quality overlays, then round control buttons (audio only when the camera
 * has it), a PTZ joystick with zoom and Presets / Auto Track / Patrol only when PTZ was verified.
 * Unsupported controls are hidden or explained, never simulated.
 */
@customElement('live-camera')
export class LiveCamera extends LitElement {
  @property() cameraId = 'cam-1';
  @state() private stream: 'main' | 'sub' = 'main';
  @state() private recording = false;
  @state() private ptzMode: 'presets' | 'track' | 'patrol' = 'presets';

  static styles = css`
    .titlerow {
      display: flex;
      align-items: center;
      gap: 10px;
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
    .video sw-scene {
      position: absolute;
      inset: 0;
    }
    .video.off {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      box-shadow: none;
      border: 1px solid var(--sw-border);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 65%, rgba(0, 0, 0, 0.45) 100%);
      pointer-events: none;
    }
    .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: 10px;
      letter-spacing: 0.04em;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 2px 7px;
    }
    .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 10px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      color: rgba(255, 255, 255, 0.92);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .quality {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-end: 10px;
      font-size: var(--sw-fs-xs);
      color: rgba(255, 255, 255, 0.92);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      direction: ltr;
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
    .controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-block-start: 12px;
    }
    .round {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .round button {
      inline-size: 38px;
      block-size: 38px;
      border-radius: 50%;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
    }
    .round button:hover {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .round button.rec {
      color: var(--sw-danger);
    }
    .round button.rec.on {
      background: var(--sw-danger);
      border-color: var(--sw-danger);
      color: #fff;
    }
    .round button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .round .q {
      inline-size: auto;
      border-radius: var(--sw-r-pill);
      padding-inline: 10px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      block-size: 30px;
    }
    .round .q.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
    .ptz {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .joy {
      position: relative;
      inline-size: 64px;
      block-size: 64px;
      border-radius: 50%;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      box-shadow: var(--sw-shadow-1);
    }
    .joy button {
      position: absolute;
      inline-size: 20px;
      block-size: 20px;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
      border-radius: 50%;
    }
    .joy button:hover {
      color: var(--sw-accent-text);
    }
    .joy .u {
      inset-block-start: 3px;
      inset-inline-start: 22px;
    }
    .joy .d {
      inset-block-end: 3px;
      inset-inline-start: 22px;
    }
    .joy .l {
      inset-inline-start: 3px;
      inset-block-start: 22px;
    }
    .joy .r {
      inset-inline-end: 3px;
      inset-block-start: 22px;
    }
    .joy .c {
      inset-inline-start: 26px;
      inset-block-start: 26px;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      background: var(--sw-accent);
    }
    .zoom {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .zoom button {
      inline-size: 28px;
      block-size: 28px;
      border-radius: 8px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    .modes {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      margin-block-start: 12px;
      align-items: start;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 14px;
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
    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
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
    const cam = demoWall.find((c) => c.id === this.cameraId) ?? demoWall[0];
    const canView = cam.state === 'live' || cam.state === 'stale';
    const scene = demoScene[cam.id] ?? 'lobby';
    return html`
      <sw-page heading=${cam.name} subheading=${`${cam.floor} · NVR ערוץ ${cam.id.replace('cam-', '')} · נתוני הדגמה`} crumbs=${`מצלמות | ${cam.floor}`}>
        <sw-badge slot="actions" kind=${cam.state}></sw-badge>
        <a slot="actions" href="#/investigate/playback"><sw-button icon="history">הקלטות</sw-button></a>
        <a slot="actions" href="#/explore/floors/f0"><sw-button variant="ghost" iconOnly icon="map" label="במפה"></sw-button></a>
        <sw-button slot="actions" variant="ghost" iconOnly icon="system" label="הגדרות מצלמה"></sw-button>
        <div>
          <div class="video ${canView ? '' : 'off'}">
            ${canView
              ? html`<sw-scene kind=${scene}></sw-scene><div class="shade"></div><span class="demo">דמו · הזרם יתחבר ב־T017</span>
                  <span class="stamp">2026-09-14 10:24:36</span>
                  <span class="quality">${this.stream === 'main' ? '1440p · H.265' : '360p · H.264'}</span>`
              : html`<div class="center"><div>
                  <sw-icon name=${cam.state === 'offline' ? 'offline' : 'lock'} size=${32}></sw-icon>
                  <span>${cam.state === 'offline' ? 'המצלמה אינה מחוברת ל־NVR' : 'אין הרשאת צפייה במצלמה זו'}</span>
                </div></div>`}
          </div>
          <div class="controls">
            <div class="round" role="group" aria-label="פקדי מצלמה">
              ${cam.audio ? html`<button title="מיקרופון" aria-label="מיקרופון" ?disabled=${!canView}><sw-icon name="mic" size=${16}></sw-icon></button><button title="שמע" aria-label="שמע" ?disabled=${!canView}><sw-icon name="volume" size=${16}></sw-icon></button>` : nothing}
              <button title="צילום מסך" aria-label="צילום מסך" ?disabled=${!canView}><sw-icon name="aperture" size=${16}></sw-icon></button>
              <button class="rec ${this.recording ? 'on' : ''}" title=${this.recording ? 'עצור הקלטה' : 'הקלט עכשיו'} aria-label=${this.recording ? 'עצור הקלטה' : 'הקלט עכשיו'} ?disabled=${!canView} @click=${() => (this.recording = !this.recording)}><sw-icon name="image" size=${16}></sw-icon></button>
              <button title="מסך מלא" aria-label="מסך מלא" ?disabled=${!canView}><sw-icon name="expand" size=${16}></sw-icon></button>
              <button class="q ${this.stream === 'main' ? 'on' : ''}" @click=${() => (this.stream = 'main')}>1440p</button>
              <button class="q ${this.stream === 'sub' ? 'on' : ''}" @click=${() => (this.stream = 'sub')}>360p</button>
              ${this.recording ? html`<sw-badge kind="error" label="הקלטה ידנית · 04:12"></sw-badge>` : nothing}
            </div>
            ${cam.ptz
              ? html`<div class="ptz" role="group" aria-label="בקרת PTZ">
                  <div class="joy">
                    <button class="u" aria-label="למעלה"><sw-icon name="chevronDown" size=${14} style="transform:rotate(180deg)"></sw-icon></button>
                    <button class="d" aria-label="למטה"><sw-icon name="chevronDown" size=${14}></sw-icon></button>
                    <button class="l" aria-label="שמאלה"><sw-icon name="chevron" size=${14} flip></sw-icon></button>
                    <button class="r" aria-label="ימינה"><sw-icon name="chevron" size=${14}></sw-icon></button>
                    <span class="c" aria-hidden="true"></span>
                  </div>
                  <div class="zoom"><button aria-label="זום פנימה"><sw-icon name="plus" size=${14}></sw-icon></button><button aria-label="זום החוצה"><sw-icon name="minus" size=${14}></sw-icon></button></div>
                </div>`
              : nothing}
          </div>
          ${cam.ptz
            ? html`<div class="modes">
                <sw-chip icon="bookmark" ?selected=${this.ptzMode === 'presets'} @click=${() => (this.ptzMode = 'presets')}>Presets</sw-chip>
                <sw-chip icon="target" ?selected=${this.ptzMode === 'track'} @click=${() => (this.ptzMode = 'track')}>מעקב אוטומטי</sw-chip>
                <sw-chip icon="route" ?selected=${this.ptzMode === 'patrol'} @click=${() => (this.ptzMode = 'patrol')}>סיור</sw-chip>
                ${this.ptzMode === 'presets' ? html`<sw-chip>1 · כניסה</sw-chip><sw-chip>2 · חניה</sw-chip><sw-chip>3 · שער</sw-chip>` : html`<span class="note" style="align-self:center">${this.ptzMode === 'track' ? 'מעקב אוטומטי דרך ה־NVR; מוצג רק אחרי אימות היכולת (T031)' : 'סיור לפי רשימת presets; הרצה דורשת הרשאת מפעיל'}</span>`}
              </div>`
            : html`<div class="note" style="margin-block-start:8px">PTZ ושמע אינם מוצגים במצלמה זו: היכולת לא אומתה. פקד שלא נתמך מוסתר או מוסבר, לא מדומה.</div>`}
          <div class="grid">
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
              <div class="tiles">
                ${demoWall.filter((c) => c.floor === cam.floor && c.id !== cam.id).slice(0, 4).map((c) => html`<sw-camera-tile compact name=${c.name} state=${c.state} scene=${demoScene[c.id] ?? 'lobby'} @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`)}
              </div>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `;
  }
}
