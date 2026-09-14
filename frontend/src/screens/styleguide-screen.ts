import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-card';
import '../components/sw-chip';
import '../components/sw-icon';
import '../components/sw-state-panel';
import type { StateKind } from '../components/sw-badge';
import type { PanelState } from '../components/sw-state-panel';
import type { IconName } from '../components/sw-icon';

const COLORS = [
  ['--sw-bg', 'רקע'], ['--sw-surface', 'משטח'], ['--sw-surface-2', 'משטח 2'], ['--sw-surface-3', 'משטח 3'], ['--sw-border', 'גבול'],
  ['--sw-text', 'טקסט'], ['--sw-text-2', 'טקסט משני'], ['--sw-text-3', 'טקסט שלישי'],
  ['--sw-accent', 'הדגשה'], ['--sw-accent-soft', 'הדגשה רכה'],
  ['--sw-live', 'חי'], ['--sw-recorded', 'מוקלט'], ['--sw-offline', 'מנותק'], ['--sw-stale', 'מיושן'], ['--sw-unknown', 'לא ידוע'], ['--sw-danger', 'שגיאה'], ['--sw-forbidden', 'אין הרשאה'],
];
const BADGES: StateKind[] = ['live', 'recorded', 'historic', 'offline', 'stale', 'partial', 'unknown', 'forbidden', 'error'];
const PANELS: PanelState[] = ['loading', 'empty', 'error', 'forbidden', 'stale', 'partial'];
const ICONS: IconName[] = ['live', 'explore', 'investigate', 'system', 'camera', 'search', 'bell', 'user', 'play', 'expand', 'close', 'chevron', 'warning', 'info', 'lock', 'unlock', 'offline', 'refresh', 'layers', 'floor', 'plus', 'minus', 'fit', 'door', 'light', 'sensor', 'check', 'clock', 'download', 'pin', 'more', 'building', 'map', 'upload', 'list', 'history'];

/** Living style guide — the "Storybook equivalent" required by DESIGN_CONTRACT. */
@customElement('styleguide-screen')
export class StyleguideScreen extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--sw-s-4);
      max-inline-size: var(--sw-content-max);
    }
    h2 {
      font-size: var(--sw-fs-2xl);
      margin: 0 0 var(--sw-s-2);
    }
    h3 {
      font-size: var(--sw-fs-lg);
      margin: var(--sw-s-6) 0 var(--sw-s-3);
    }
    .lead {
      color: var(--sw-text-2);
      margin: 0 0 var(--sw-s-4);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .swatches {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: var(--sw-s-2);
    }
    .swatch {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      background: var(--sw-surface);
      font-size: var(--sw-fs-xs);
    }
    .swatch .c {
      block-size: 44px;
    }
    .swatch .n {
      padding: 6px 8px;
      display: flex;
      justify-content: space-between;
      gap: 4px;
    }
    .type p {
      margin: 0 0 var(--sw-s-1);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--sw-s-3);
    }
    .icons {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      gap: var(--sw-s-2);
    }
    .icon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: var(--sw-s-2);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .panel {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
  `;

  render() {
    return html`
      <h2>ספריית רכיבים ו־tokens</h2>
      <p class="lead">מקור השפה החזותית: שלושת לוחות ההדמיה ב־docs/design/reference. משטחים בהירים, טקסט כהה, כחול מאופק, מחיצות דקות, פינות מעוגלות במידה, צל מינימלי.</p>

      <h3>צבעים</h3>
      <div class="swatches">
        ${COLORS.map(([v, n]) => html`<div class="swatch"><div class="c" style="background:var(${v})"></div><div class="n"><span>${n}</span><span class="ltr">${v}</span></div></div>`)}
      </div>

      <h3>טיפוגרפיה</h3>
      <div class="type">
        <p style="font-size:var(--sw-fs-3xl);font-weight:var(--sw-fw-bold)">כותרת ראשית 30</p>
        <p style="font-size:var(--sw-fs-2xl);font-weight:var(--sw-fw-semibold)">כותרת מסך 24</p>
        <p style="font-size:var(--sw-fs-xl);font-weight:var(--sw-fw-semibold)">כותרת אזור 20</p>
        <p style="font-size:var(--sw-fs-lg);font-weight:var(--sw-fw-semibold)">כותרת כרטיס 16</p>
        <p>טקסט גוף 14 — מפה של אתר, מבנה וקומה היא משטח העבודה המרכזי.</p>
        <p style="font-size:var(--sw-fs-sm);color:var(--sw-text-2)">טקסט משני 13</p>
        <p style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">תווית 12 · <span class="ltr">2026-09-14T08:05:38Z</span> נשאר LTR</p>
      </div>

      <h3>כפתורים</h3>
      <div class="row">
        <sw-button variant="primary" icon="play">ראשי</sw-button>
        <sw-button icon="history">משני</sw-button>
        <sw-button variant="ghost" icon="pin">שקוף</sw-button>
        <sw-button variant="danger">מסוכן</sw-button>
        <sw-button variant="primary" disabled>מושבת</sw-button>
        <sw-button size="sm">קטן</sw-button>
        <sw-button size="lg" variant="primary">גדול</sw-button>
        <sw-button iconOnly icon="refresh" label="רענון"></sw-button>
      </div>

      <h3>צ׳יפים</h3>
      <div class="row">
        <sw-chip icon="floor" selected count=${6}>קומה 0</sw-chip>
        <sw-chip icon="floor" count=${3}>קומה 1-</sw-chip>
        <sw-chip icon="camera" selected>מצלמות</sw-chip>
        <sw-chip icon="door">דלתות</sw-chip>
      </div>

      <h3>תגי מצב (צורה + טקסט, לא צבע בלבד)</h3>
      <div class="row">${BADGES.map((k) => html`<sw-badge kind=${k}></sw-badge>`)}</div>

      <h3>מצבי מסך</h3>
      <div class="grid">
        ${PANELS.map((p) => html`<div class="panel"><sw-state-panel state=${p} actionLabel=${p === 'error' ? 'נסה שוב' : ''}></sw-state-panel></div>`)}
      </div>

      <h3>כרטיסים</h3>
      <div class="grid">
        <sw-card heading="כרטיס עם כותרת"><sw-button slot="actions" size="sm" variant="ghost" iconOnly icon="more" label="עוד"></sw-button>תוכן הכרטיס. ריווח 16, רדיוס 12, צל עדין.</sw-card>
        <sw-card interactive>כרטיס לחיץ (hover מגביה מעט).</sw-card>
        <sw-card flush><sw-state-panel compact state="stale"></sw-state-panel></sw-card>
      </div>

      <h3>אייקונים</h3>
      <div class="icons">${ICONS.map((i) => html`<div class="icon"><sw-icon .name=${i} size=${22}></sw-icon><span class="ltr">${i}</span></div>`)}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'styleguide-screen': StyleguideScreen;
  }
}
