import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-chip';
import '../components/sw-button';
import '../components/sw-tabs';
import { demoScene, demoWall } from '../fixtures/catalog';
import { navigate } from '../router';

const COUNTS = [1, 2, 4, 6, 8, 9, 12, 16];
const VIEWS = [
  { id: 'all', label: 'כל המצלמות' },
  { id: 'outside', label: 'חוץ' },
  { id: 'inside', label: 'פנים' },
  { id: 'night', label: 'לילה' },
];

/** SC07 — live camera wall (board 1 screen 6; legacy: 1/2/4/6/8/12/16, ordering, auto/main/sub). */
@customElement('live-wall')
export class LiveWall extends LitElement {
  @state() private count = 6;
  @state() private stream: 'auto' | 'main' | 'sub' = 'auto';
  @state() private view = 'all';

  static styles = css`
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2);
    }
    .toolbar .grow {
      flex: 1;
    }
    .layouts {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 3px;
    }
    .layouts button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      min-inline-size: 30px;
      block-size: 28px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .layouts button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .grid {
      display: grid;
      gap: var(--sw-s-3);
      grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr));
      }
    }
  `;

  render() {
    const cams = demoWall.slice(0, this.count);
    const cols = this.count === 1 ? 1 : this.count === 2 ? 2 : this.count <= 4 ? 2 : this.count <= 9 ? 3 : 4;
    return html`
      <sw-page heading="קיר מצלמות" subheading="תצוגה שמורה: ${VIEWS.find((v) => v.id === this.view)?.label} · נתוני הדגמה" wide>
        <a slot="actions" href="#/live/views"><sw-button icon="layers">תצוגות שמורות</sw-button></a>
        <a slot="actions" href="#/kiosk/all"><sw-button icon="expand" variant="ghost">מצב קיוסק</sw-button></a>
        <div class="toolbar">
          <sw-tabs .items=${VIEWS} .active=${this.view} @change=${(e: CustomEvent<{ id: string }>) => (this.view = e.detail.id)}></sw-tabs>
          <span class="grow"></span>
          <sw-tabs .items=${[{ id: 'auto', label: 'אוטומטי' }, { id: 'main', label: 'ראשי' }, { id: 'sub', label: 'משני' }]} .active=${this.stream} @change=${(e: CustomEvent<{ id: string }>) => (this.stream = e.detail.id as 'auto')}></sw-tabs>
          <div class="layouts" role="group" aria-label="מספר אריחים">
            ${COUNTS.map((n) => html`<button class=${n === this.count ? 'on' : ''} @click=${() => (this.count = n)} aria-pressed=${n === this.count}>${n}</button>`)}
          </div>
        </div>
        <div class="grid" style="--cols:${cols}">
          ${cams.map(
            (c) => html`<sw-camera-tile name=${c.name} meta=${`${c.floor} · ${this.stream === 'auto' ? (this.count > 4 ? 'משני' : 'ראשי') : this.stream === 'main' ? 'ראשי' : 'משני'}`} state=${c.state} scene=${demoScene[c.id] ?? 'indoor'} stamp="10:24:36" ?compact=${this.count >= 9} @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`,
          )}
        </div>
        <div class="note">קיר של ${this.count} אריחים אינו פותח ${this.count} זרמים ראשיים במקביל: במצב אוטומטי מוצג הזרם המשני במטריצה והראשי במיקוד. סדר ובחירת מצלמות נשמרים בתצוגה.</div>
      </sw-page>
    `;
  }
}
