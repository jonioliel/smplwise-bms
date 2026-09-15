import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { demoScene, demoWall } from '../fixtures/catalog';
import { navigate } from '../router';
import { isApi } from '../api/session';
import { snapshotUrl, type ProductSettings, type Transport } from '../api/media';
import { listCameras } from '../api/maps';
import { effectiveTransport, productSettings } from '../api/prefs';
import { describeError } from '../api/client';
import type { Camera } from '../api/types';

const COUNTS = [1, 2, 4, 6, 8, 9, 12, 16];
const VIEWS = [
  { id: 'all', label: 'כל המצלמות' },
  { id: 'outside', label: 'חוץ' },
  { id: 'inside', label: 'פנים' },
  { id: 'night', label: 'לילה' },
];

/** SC07 — multi-camera grid (board 1 screen 6): real streams (sub profile) with snapshot posters, or the demo grid. */
@customElement('live-wall')
export class LiveWall extends LitElement {
  @state() private count = 4;
  @state() private stream: 'auto' | 'main' | 'sub' = 'auto';
  @state() private view = 'all';
  @state() private cams: Camera[] | null = null;
  @state() private settings: ProductSettings | null = null;
  @state() private error = '';
  @state() private posterBust = Date.now();
  private posterTimer: number | undefined;

  static styles = css`
    .layouts {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: 8px;
      padding: 2px;
    }
    .layouts button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      min-inline-size: 28px;
      block-size: 26px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--sw-text-2);
      padding: 0 6px;
    }
    .layouts button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    sw-field {
      inline-size: 140px;
    }
    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr));
        gap: 8px;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    this.posterTimer = window.setInterval(() => (this.posterBust = Date.now()), 60_000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.posterTimer);
  }

  private async load() {
    if (!isApi()) return;
    try {
      const [list, settings] = await Promise.all([listCameras(), productSettings()]);
      this.cams = list.cameras.filter((c) => c.enabled);
      this.settings = settings;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private renderApi() {
    const cams = this.cams;
    if (this.error) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    if (!cams) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (!cams.length) return html`<sw-state-panel state="empty" heading="אין מצלמות זמינות" hint="המצלמות מתגלות אוטומטית מה־NVR בהפעלה ובכל 10 דקות. אם הרשימה ריקה: בדוק את פרטי ה־NVR בהגדרות ה־Add-on ואת יומן ה־Add-on, או הרץ סנכרון ידני; ייתכן גם שאין לך הרשאה למצלמות."><div style="margin-block-start:10px"><sw-button @click=${() => navigate('/system/devices')}>למצלמות</sw-button></div></sw-state-panel>`;
    const shown = cams.slice(0, this.count);
    const cols = this.count === 1 ? 1 : this.count === 2 ? 2 : this.count <= 4 ? 2 : this.count <= 9 ? 3 : 4;
    const cap = this.settings?.['media.max_live_sessions'] ?? 8;
    const profile: 'sub' | 'main' = this.stream === 'auto' ? (this.settings?.['media.wall_profile'] ?? 'sub') : this.stream;
    const transport: Transport = effectiveTransport(this.settings);
    return html`
      <div class="grid" style="--cols:${cols}">
        ${shown.map(
          (c, i) => html`<sw-camera-tile
            name=${c.name}
            state=${c.status === 'online' ? 'live' : c.status === 'offline' ? 'offline' : 'unknown'}
            ?live=${c.status !== 'offline' && c.can_view_live !== false && i < cap}
            cameraId=${c.id}
            profile=${profile}
            transport=${transport}
            poster=${c.status === 'offline' ? '' : snapshotUrl(c.id, this.posterBust)}
            ?compact=${this.count >= 9}
            @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`,
        )}
      </div>
      <div class="note">${shown.length} מתוך ${cams.length} מצלמות · פרופיל ${profile === 'sub' ? 'משני' : 'ראשי'} · תעבורה ${transport} · מכסת זרמים ${cap}${shown.length > cap ? ` — מעבר למכסה מוצג צילום בלבד` : ''} · צילומים מתרעננים כל דקה</div>
    `;
  }

  private renderDemo() {
    const cams = demoWall.slice(0, this.count);
    const cols = this.count === 1 ? 1 : this.count === 2 ? 2 : this.count <= 4 ? 2 : this.count <= 9 ? 3 : 4;
    return html`
      <div class="grid" style="--cols:${cols}">
        ${cams.map((c) => html`<sw-camera-tile name=${c.name} meta=${`${c.floor} · ${this.stream === 'auto' ? (this.count > 4 ? 'משני' : 'ראשי') : this.stream === 'main' ? 'ראשי' : 'משני'}`} state=${c.state} scene=${demoScene[c.id] ?? 'lobby'} ?compact=${this.count >= 9} @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`)}
      </div>
      <div class="note">נתוני הדגמה: קיר של ${this.count} אריחים אינו פותח ${this.count} זרמים ראשיים במקביל; במצב אוטומטי מוצג הזרם המשני במטריצה והראשי במיקוד.</div>
    `;
  }

  render() {
    const api = isApi();
    const total = api ? this.cams?.length ?? 0 : demoWall.length;
    return html`
      <sw-page heading="כל המצלמות" subheading="${total} מצלמות${api ? '' : ` · תצוגה: ${VIEWS.find((v) => v.id === this.view)?.label} · נתוני הדגמה`}" wide>
        ${api ? nothing : html`<sw-field slot="actions"><select aria-label="תצוגה" @change=${(e: Event) => (this.view = (e.target as HTMLSelectElement).value)}>${VIEWS.map((v) => html`<option value=${v.id} ?selected=${v.id === this.view}>${v.label}</option>`)}</select></sw-field>`}
        <sw-field slot="actions"><select aria-label="זרם" @change=${(e: Event) => (this.stream = (e.target as HTMLSelectElement).value as 'auto')}><option value="auto">חי · אוטומטי</option><option value="main">חי · ראשי</option><option value="sub">חי · משני</option></select></sw-field>
        <div slot="actions" class="layouts" role="group" aria-label="פריסה">
          ${COUNTS.map((n) => html`<button class=${n === this.count ? 'on' : ''} @click=${() => (this.count = n)} aria-pressed=${n === this.count}>${n}</button>`)}
        </div>
        <a slot="actions" href="#/kiosk/all"><sw-button variant="ghost" iconOnly icon="expand" label="מצב קיוסק"></sw-button></a>
        ${api ? this.renderApi() : this.renderDemo()}
      </sw-page>
    `;
  }
}
