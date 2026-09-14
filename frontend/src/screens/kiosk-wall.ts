import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-icon';
import { demoScene, demoWall } from '../fixtures/catalog';

/** SC31 — kiosk / wall display (board 3 screen 24): dark navy, 3×3 tiles, big stat tiles, no admin controls. */
@customElement('kiosk-wall')
export class KioskWall extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      background: #0f172a;
      color: #fff;
      padding: var(--sw-s-4) var(--sw-s-5);
      gap: var(--sw-s-3);
    }
    header {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
    }
    header img {
      block-size: 28px;
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
      font-family: var(--sw-font-mono);
      direction: ltr;
      font-size: var(--sw-fs-xl);
      color: rgba(255, 255, 255, 0.85);
      font-variant-numeric: tabular-nums;
    }
    .grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--sw-s-3);
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sw-s-3);
    }
    .stat {
      background: #172036;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: var(--sw-r-md);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stat .ic {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 9px;
      background: rgba(47, 107, 255, 0.22);
      color: #8fb0ff;
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
      font-size: var(--sw-fs-xs);
      color: rgba(255, 255, 255, 0.45);
    }
    @media (max-width: 767px) {
      .grid,
      .stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;

  render() {
    const base = import.meta.env.BASE_URL;
    const cams = demoWall.filter((c) => c.state !== 'forbidden').slice(0, 9);
    return html`
      <header>
        <img src="${base}brand/smplwise-mark.png" alt="SmplWise" />
        <h1>תצוגת קיר · כל המצלמות</h1>
        <span class="spacer"></span>
        <sw-badge kind="live" label="9 מצלמות · 7 חיות"></sw-badge>
        <span class="clock">2026-09-14 10:24:36</span>
      </header>
      <div class="grid">${cams.map((c) => html`<sw-camera-tile dark compact name=${c.name} meta=${c.floor} state=${c.state} scene=${demoScene[c.id] ?? 'indoor'} stamp="10:24:36"></sw-camera-tile>`)}</div>
      <div class="stats">
        <div class="stat"><div class="ic"><sw-icon name="camera" size=${18}></sw-icon></div><div><b>7/9</b><span>מצלמות מחוברות</span></div></div>
        <div class="stat"><div class="ic"><sw-icon name="bell" size=${18}></sw-icon></div><div><b>3</b><span>התראות פתוחות</span></div></div>
        <div class="stat"><div class="ic"><sw-icon name="building" size=${18}></sw-icon></div><div><b>2</b><span>מבנים</span></div></div>
        <div class="stat"><div class="ic"><sw-icon name="activity" size=${18}></sw-icon></div><div><b style="font-size:var(--sw-fs-xl)">חלקי</b><span>מצב מערכת · גשר HA לא רענן</span></div></div>
      </div>
      <div class="note">עיקרון (principal) מוגבל לקריאה בלבד · ללא פקדי ניהול · חיבור מחדש אוטומטי · נתוני הדגמה</div>
    `;
  }
}
