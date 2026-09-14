import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import { demoWall } from '../fixtures/catalog';

/** SC31 — kiosk / wall display (board 3 screen 24): readable from a distance, no admin controls. */
@customElement('kiosk-wall')
export class KioskWall extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      background: #0b1220;
      color: #fff;
      padding: var(--sw-s-4);
      gap: var(--sw-s-3);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
    }
    .clock {
      font-family: var(--sw-font-mono);
      direction: ltr;
      font-size: var(--sw-fs-xl);
      color: rgba(255, 255, 255, 0.8);
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
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--sw-r-md);
      padding: var(--sw-s-3) var(--sw-s-4);
      display: flex;
      align-items: baseline;
      gap: var(--sw-s-2);
    }
    .stat b {
      font-size: var(--sw-fs-3xl);
    }
    .stat span {
      color: rgba(255, 255, 255, 0.7);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: rgba(255, 255, 255, 0.5);
    }
    @media (max-width: 767px) {
      .grid,
      .stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;

  render() {
    const cams = demoWall.filter((c) => c.state !== 'forbidden').slice(0, 9);
    return html`
      <header>
        <h1>תצוגת קיר · כל המצלמות</h1>
        <span class="clock">2026-09-14 10:24:36</span>
      </header>
      <div class="grid">${cams.map((c) => html`<sw-camera-tile dark compact name=${c.name} meta=${c.floor} state=${c.state}></sw-camera-tile>`)}</div>
      <div class="stats">
        <div class="stat"><b>9</b><span>מצלמות</span></div>
        <div class="stat"><b>3</b><span>התראות</span></div>
        <div class="stat"><b>2</b><span>מבנים</span></div>
        <div class="stat"><b style="font-size:var(--sw-fs-xl)">חלקי</b><span>מצב מערכת</span></div>
      </div>
      <div class="note">עיקרון (principal) מוגבל לקריאה בלבד · ללא פקדי ניהול · חיבור מחדש אוטומטי · נתוני הדגמה</div>
    `;
  }
}
