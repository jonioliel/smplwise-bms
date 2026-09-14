import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-card';
import '../components/sw-chip';
import '../components/sw-icon';
import '../components/sw-kpi';
import '../components/sw-tabs';
import '../components/sw-scene';
import '../components/sw-camera-tile';
import '../components/sw-avatar';
import '../components/sw-floor-iso';
import '../components/sw-steps';
import '../components/sw-toggle';
import '../components/sw-timeline';
import '../components/sw-state-panel';
import type { StateKind } from '../components/sw-badge';
import type { PanelState } from '../components/sw-state-panel';
import type { IconName } from '../components/sw-icon';
import type { SceneKind } from '../components/sw-scene';
import { demoSegments } from '../fixtures/catalog';
import { demoRooms } from '../fixtures/demo';

const COLORS = [
  ['--sw-bg', 'רקע'], ['--sw-surface', 'משטח'], ['--sw-surface-3', 'משטח 3'], ['--sw-border', 'גבול'],
  ['--sw-text', 'טקסט'], ['--sw-text-2', 'טקסט משני'], ['--sw-text-3', 'טקסט שלישי'],
  ['--sw-accent', 'כחול'], ['--sw-accent-soft', 'כחול רך'],
  ['--sw-live', 'חי'], ['--sw-offline', 'מנותק'], ['--sw-stale', 'מיושן'], ['--sw-danger', 'שגיאה'], ['--sw-purple', 'סגול (דלת)'],
];
const BADGES: StateKind[] = ['live', 'recorded', 'historic', 'offline', 'stale', 'partial', 'unknown', 'forbidden', 'error'];
const PANELS: PanelState[] = ['loading', 'empty', 'error', 'forbidden', 'stale', 'partial'];
const SCENES: SceneKind[] = ['entrance', 'lobby', 'corridor', 'hall', 'parking', 'warehouse', 'backyard', 'driveway', 'night', 'building', 'house'];
const ICONS: IconName[] = ['dashboard', 'building', 'camera', 'bell', 'history', 'system', 'search', 'user', 'play', 'pause', 'back10', 'forward10', 'aperture', 'volume', 'mic', 'expand', 'close', 'chevron', 'chevronDown', 'warning', 'info', 'lock', 'unlock', 'offline', 'refresh', 'layers', 'floor', 'plus', 'minus', 'fit', 'door', 'light', 'sensor', 'check', 'clock', 'download', 'pin', 'more', 'map', 'upload', 'list', 'target', 'filter', 'users', 'shield', 'storage', 'edit', 'case', 'rule', 'link', 'grid', 'home', 'star', 'calendar', 'trash', 'eye', 'cpu', 'activity', 'image', 'wifi', 'signal', 'move', 'bookmark', 'route'];

/** Living style guide — the "Storybook equivalent" required by DESIGN_CONTRACT (tokens v3, boards language). */
@customElement('styleguide-screen')
export class StyleguideScreen extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 14px 24px 24px;
      max-inline-size: var(--sw-content-max);
    }
    h2 {
      font-size: var(--sw-fs-2xl);
      margin: 0 0 4px;
      font-weight: var(--sw-fw-semibold);
    }
    h3 {
      font-size: var(--sw-fs-md);
      margin: 22px 0 10px;
      font-weight: var(--sw-fw-semibold);
    }
    .lead {
      color: var(--sw-text-3);
      margin: 0 0 12px;
      font-size: var(--sw-fs-sm);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .swatches {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 8px;
    }
    .swatch {
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      overflow: hidden;
      background: var(--sw-surface);
      font-size: var(--sw-fs-xs);
    }
    .swatch .c {
      block-size: 36px;
    }
    .swatch .n {
      padding: 5px 8px;
      display: flex;
      justify-content: space-between;
      gap: 4px;
    }
    .type p {
      margin: 0 0 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }
    .scenes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .scenes div {
      aspect-ratio: 16 / 9;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
      font-size: 10px;
    }
    .scenes span {
      position: absolute;
      inset-inline-start: 6px;
      inset-block-end: 5px;
      color: #fff;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      direction: ltr;
    }
    .icons {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
      gap: 6px;
    }
    .icon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 8px 4px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface);
      font-size: 9.5px;
      color: var(--sw-text-2);
    }
    .panel {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 10px;
    }
  `;

  render() {
    return html`
      <h2>ספריית רכיבים ו־tokens (v3)</h2>
      <p class="lead">מקור השפה החזותית: שלושת לוחות ההדמיה ב־docs/design/reference. ממשק קומפקטי (12px), משטחים לבנים על רקע קריר, מחיצות דקות, כחול אחד במשורה, ירוק רק ל"מחובר", צל שקט, סצנות מאוירות עד חיבור זרמים.</p>

      <h3>צבעים</h3>
      <div class="swatches">
        ${COLORS.map(([v, n]) => html`<div class="swatch"><div class="c" style="background:var(${v})"></div><div class="n"><span>${n}</span><span class="ltr">${v}</span></div></div>`)}
      </div>

      <h3>טיפוגרפיה (Heebo, מארח מקומית)</h3>
      <div class="type">
        <p style="font-size:var(--sw-fs-3xl);font-weight:var(--sw-fw-bold)">מספר גדול 24</p>
        <p style="font-size:var(--sw-fs-2xl);font-weight:var(--sw-fw-semibold)">כותרת מסך 18</p>
        <p style="font-size:var(--sw-fs-lg);font-weight:var(--sw-fw-semibold)">כותרת אזור 14</p>
        <p style="font-size:var(--sw-fs-md);font-weight:var(--sw-fw-semibold)">כותרת כרטיס 12.5</p>
        <p>טקסט גוף 12.5 — מפה של אתר, מבנה וקומה היא משטח העבודה המרכזי.</p>
        <p style="font-size:var(--sw-fs-sm);color:var(--sw-text-2)">טקסט משני 11.5</p>
        <p style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">תווית 10.5 · <span class="ltr">2026-09-14T08:05:38Z</span> נשאר LTR</p>
      </div>

      <h3>כרטיסי KPI</h3>
      <div class="kpis">
        <sw-kpi icon="camera" tone="live" value="24" label="מצלמות" detail="מחוברות"></sw-kpi>
        <sw-kpi icon="building" value="3" label="אתרים" detail="פעילים" tone="neutral"></sw-kpi>
        <sw-kpi icon="bell" value="12" label="אירועים" detail="ב־24 השעות" tone="neutral" badge="3 חדשים"></sw-kpi>
        <sw-kpi icon="shield" tone="stale" value="חלקי" label="מצב מערכת" detail="גשר HA לא רענן"></sw-kpi>
      </div>

      <h3>סצנות מאוירות (מצייני מקום, לא פריימים)</h3>
      <div class="scenes">${SCENES.map((s) => html`<div><sw-scene kind=${s}></sw-scene><span>${s}</span></div>`)}</div>

      <h3>אריחי מצלמה</h3>
      <div class="grid">
        <sw-camera-tile name="כניסה ראשית" state="live" scene="entrance"></sw-camera-tile>
        <sw-camera-tile name="חדר מדרגות" state="stale" scene="corridor"></sw-camera-tile>
        <sw-camera-tile name="מסדרון מזרחי" state="offline"></sw-camera-tile>
        <sw-camera-tile name="חניה" state="forbidden"></sw-camera-tile>
      </div>

      <h3>כפתורים, צ׳יפים, טאבים</h3>
      <div class="row">
        <sw-button variant="primary" icon="play">ראשי</sw-button>
        <sw-button icon="history">משני</sw-button>
        <sw-button variant="ghost" icon="pin">שקוף</sw-button>
        <sw-button variant="danger">מסוכן</sw-button>
        <sw-button variant="primary" disabled>מושבת</sw-button>
        <sw-button size="sm">קטן</sw-button>
        <sw-button iconOnly icon="refresh" label="רענון"></sw-button>
        <sw-chip selected>הכל</sw-chip><sw-chip dot="#ef4444">תנועה</sw-chip><sw-chip dot="#2f6bff">אדם</sw-chip><sw-chip dot="#22c55e">רכב</sw-chip>
        <sw-tabs .items=${[{ id: 'a', label: 'כל האתרים', count: 3 }, { id: 'b', label: 'מבנים' }, { id: 'c', label: 'מפה' }]} active="a"></sw-tabs>
        <sw-toggle checked label="מופעל"></sw-toggle>
        <sw-avatar name="יוני"></sw-avatar>
      </div>

      <h3>תגי מצב (צורה + טקסט, לא צבע בלבד)</h3>
      <div class="row">${BADGES.map((k) => html`<sw-badge kind=${k}></sw-badge>`)}</div>

      <h3>ציר זמן, שלבים, קומות איזומטריות</h3>
      <sw-timeline .segments=${demoSegments} .events=${[{ minute: 614, kind: 'person', label: 'אדם' }, { minute: 582, kind: 'vehicle', label: 'רכב' }]} .cursor=${615}></sw-timeline>
      <div class="row" style="margin-block-start:10px">
        <sw-card style="flex:1;min-inline-size:280px"><sw-steps .steps=${['גילוי', 'הגדרה', 'בדיקה', 'סיום']} .current=${1}></sw-steps></sw-card>
        <sw-floor-iso .rooms=${demoRooms('f0')} selected></sw-floor-iso>
        <sw-floor-iso .rooms=${demoRooms('f-1')}></sw-floor-iso>
        <sw-floor-iso empty></sw-floor-iso>
      </div>

      <h3>מצבי מסך</h3>
      <div class="grid">
        ${PANELS.map((p) => html`<div class="panel"><sw-state-panel state=${p} actionLabel=${p === 'error' ? 'נסה שוב' : ''}></sw-state-panel></div>`)}
      </div>

      <h3>אייקונים</h3>
      <div class="icons">${ICONS.map((i) => html`<div class="icon"><sw-icon .name=${i} size=${18}></sw-icon><span class="ltr">${i}</span></div>`)}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'styleguide-screen': StyleguideScreen;
  }
}
