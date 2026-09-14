import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-icon';
import { demoScene, demoWall } from '../fixtures/catalog';
import { isApi, onSession } from '../api/session';
import { snapshotUrl, type ProductSettings } from '../api/media';
import { listCameras } from '../api/maps';
import { effectiveTransport, productSettings } from '../api/prefs';
import type { Camera } from '../api/types';

/** SC31 — wall display / kiosk (board 3 screen 24): dark navy, 3×3 tiles (real sub streams when a backend exists), big stat tiles, no admin controls. */
@customElement('kiosk-wall')
export class KioskWall extends LitElement {
  @state() private cams: Camera[] | null = null;
  @state() private settings: ProductSettings | null = null;
  @state() private clock = '';
  private timer: number | undefined;
  private unsubscribe: (() => void) | undefined;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      background: #0f172a;
      color: #fff;
      padding: 14px 20px 16px;
      gap: 12px;
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    header img {
      block-size: 24px;
      inline-size: auto;
      filter: brightness(0) invert(1);
      opacity: 0.9;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
    }
    .spacer {
      flex: 1;
    }
    .clock {
      font-size: var(--sw-fs-sm);
      color: rgba(255, 255, 255, 0.75);
      font-variant-numeric: tabular-nums;
      direction: ltr;
    }
    .grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .grid sw-camera-tile {
      border-radius: 8px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .stat {
      background: #172036;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stat .ic {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 8px;
      background: rgba(47, 107, 255, 0.22);
      color: #8fb0ff;
    }
    .stat .ic.red {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }
    .stat .ic.green {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }
    .stat b {
      display: block;
      font-size: var(--sw-fs-2xl);
      line-height: 1.1;
    }
    .stat span {
      color: rgba(255, 255, 255, 0.6);
      font-size: var(--sw-fs-xs);
    }
    .note {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
    }
    @media (max-width: 767px) {
      .grid,
      .stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 1000);
    // The kiosk renders outside the session gate, so wait for the backend answer instead of assuming demo.
    this.unsubscribe = onSession((s) => {
      if (s.mode === 'api' && this.cams === null) void this.load();
      else if (s.mode !== 'loading') this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
    this.unsubscribe?.();
  }

  private tick() {
    const d = new Date();
    this.clock = `${d.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('he-IL')}`;
  }

  private async load() {
    if (!isApi()) return;
    try {
      const [list, settings] = await Promise.all([listCameras(), productSettings()]);
      this.cams = list.cameras.filter((c) => c.enabled);
      this.settings = settings;
    } catch {
      this.cams = [];
    }
  }

  render() {
    const base = import.meta.env.BASE_URL;
    const api = isApi();
    const real = api ? (this.cams ?? []).slice(0, 9) : [];
    const demo = demoWall.filter((c) => c.state !== 'forbidden').slice(0, 9);
    const online = api ? real.filter((c) => c.status === 'online').length : 7;
    const cap = this.settings?.['media.max_live_sessions'] ?? 8;
    return html`
      <header>
        <img src="${base}brand/smplwise-mark.png" alt="SmplWise" />
        <h1>ניטור חי</h1>
        <span class="spacer"></span>
        <sw-badge kind="live" label=${`${api ? real.length : demo.length} מצלמות · ${online} חיות`}></sw-badge>
        <span class="clock">${this.clock || '—'}</span>
      </header>
      <div class="grid">
        ${api
          ? real.map((c, i) => html`<sw-camera-tile dark name=${c.name} state=${c.status === 'online' ? 'live' : c.status === 'offline' ? 'offline' : 'unknown'} ?live=${c.status !== 'offline' && i < cap} cameraId=${c.id} profile="sub" transport=${effectiveTransport(this.settings)} poster=${c.status === 'offline' ? '' : snapshotUrl(c.id)} noDemo></sw-camera-tile>`)
          : demo.map((c) => html`<sw-camera-tile dark name=${c.name} state=${c.state} scene=${demoScene[c.id] ?? 'lobby'} noDemo></sw-camera-tile>`)}
      </div>
      <div class="stats">
        <div class="stat"><div class="ic"><sw-icon name="camera" size=${16}></sw-icon></div><div><b>${api ? `${online}/${real.length}` : '7/9'}</b><span>מצלמות מחוברות</span></div></div>
        <div class="stat"><div class="ic red"><sw-icon name="warning" size=${16}></sw-icon></div><div><b>${api ? real.filter((c) => c.status === 'offline').length : 3}</b><span>${api ? 'מצלמות מנותקות' : 'התראות פתוחות'}</span></div></div>
        <div class="stat"><div class="ic"><sw-icon name="building" size=${16}></sw-icon></div><div><b>${api ? Math.min(real.length, cap) : 2}</b><span>${api ? 'זרמים חיים במקביל' : 'מבנים'}</span></div></div>
        <div class="stat"><div class="ic green"><sw-icon name="check" size=${16}></sw-icon></div><div><b style="font-size:var(--sw-fs-lg)">${api ? 'פעיל' : 'חלקי'}</b><span>${api ? 'go2rtc + NVR' : 'מצב מערכת · גשר HA לא רענן'}</span></div></div>
      </div>
      <div class="note">תצוגת קיוסק: קריאה בלבד, ללא פקדי ניהול, חיבור מחדש אוטומטי${api ? '' : ' · נתוני הדגמה (סצנות מאוירות עד חיבור הזרמים)'}</div>
    `;
  }
}
