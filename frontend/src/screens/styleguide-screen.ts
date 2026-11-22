import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { settingsLadderStyles } from '../styles/settings';
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
// GATE2342-A: the style guide hosts the shared components' browser checks (tests/a11y-polished-2342.spec.ts mounts a popover on it);
// since the screens are lazy chunks (PERF-HOME-DEVICES-2342) only the floor map's chunk defined <sw-popover>
import '../components/sw-popover';
import type { StateKind } from '../components/sw-badge';
import type { PanelState } from '../components/sw-state-panel';
import type { IconName } from '../components/sw-icon';
import type { SceneKind } from '../components/sw-scene';
import { demoSegments } from '../fixtures/catalog';
import { demoRooms } from '../fixtures/demo';
import { demoSceneInput, demoSceneLabels } from '../fixtures/demo-3d';
import { buildScene, type SceneDescription } from '../map/scene-builder';
import { WEBGL_UNAVAILABLE_HE, webglAvailable } from '../map/webgl';
import type { PartSelectDetail } from '../map/sw-plan-3d';
import { tr } from '../i18n/msg/screens';

const COLORS = [
  ['--sw-bg', tr('רקע')], ['--sw-surface', tr('משטח')], ['--sw-surface-3', tr('משטח 3')], ['--sw-border', tr('גבול')],
  ['--sw-text', tr('טקסט')], ['--sw-text-2', tr('טקסט משני')], ['--sw-text-3', tr('טקסט שלישי')],
  ['--sw-accent', tr('כחול')], ['--sw-accent-soft', tr('כחול רך')],
  ['--sw-live', tr('חי')], ['--sw-offline', tr('מנותק')], ['--sw-stale', tr('מיושן')], ['--sw-danger', tr('שגיאה')], ['--sw-purple', tr('סגול (דלת)')],
];
const BADGES: StateKind[] = ['live', 'recorded', 'historic', 'offline', 'stale', 'partial', 'unknown', 'forbidden', 'error'];
const PANELS: PanelState[] = ['loading', 'empty', 'error', 'forbidden', 'stale', 'partial'];
const SCENES: SceneKind[] = ['entrance', 'lobby', 'corridor', 'hall', 'parking', 'warehouse', 'backyard', 'driveway', 'night', 'building', 'house'];
const ICONS: IconName[] = ['dashboard', 'building', 'camera', 'bell', 'history', 'system', 'search', 'user', 'play', 'pause', 'back10', 'forward10', 'aperture', 'volume', 'mic', 'expand', 'close', 'chevron', 'chevronDown', 'warning', 'info', 'lock', 'unlock', 'offline', 'refresh', 'layers', 'floor', 'plus', 'minus', 'fit', 'door', 'light', 'sensor', 'check', 'clock', 'download', 'pin', 'more', 'map', 'upload', 'list', 'target', 'filter', 'users', 'shield', 'storage', 'edit', 'case', 'rule', 'link', 'grid', 'home', 'star', 'calendar', 'trash', 'eye', 'cpu', 'activity', 'image', 'wifi', 'signal', 'move', 'bookmark', 'route'];

/** Living style guide — the "Storybook equivalent" required by DESIGN_CONTRACT (tokens v3, boards language). */
@customElement('styleguide-screen')
export class StyleguideScreen extends LitElement {
  /** T087: the 3D element, loaded on demand (the click is what fetches the three chunk), on the demo floor f0. */
  @state() private demo3d: { loading: boolean; error: string; desc: SceneDescription | null; selected: string | null } = { loading: false, error: '', desc: null, selected: null };

  private async load3d(): Promise<void> {
    if (this.demo3d.loading || this.demo3d.desc) return;
    this.demo3d = { ...this.demo3d, loading: true, error: '' };
    try {
      await import('../map/sw-plan-3d');
      const input = demoSceneInput('f0');
      this.demo3d = { loading: false, error: '', desc: input ? buildScene(input) : null, selected: null };
    } catch (err) {
      this.demo3d = { loading: false, error: err instanceof Error ? err.message : String(err), desc: null, selected: null };
    }
  }

  /** CR-029 S1: the demo floor's description with its realistic part while the element draws level 3. */
  private demoRealistic = false;
  private onRealistic(on: boolean): void {
    if (on === this.demoRealistic || !this.demo3d.desc) return;
    this.demoRealistic = on;
    const input = demoSceneInput('f0');
    if (input) this.demo3d = { ...this.demo3d, desc: buildScene({ ...input, realistic: on }) };
  }

  static styles = [settingsLadderStyles, css`
    :host {
      display: block;
      padding: 14px 24px 24px;
      max-inline-size: var(--sw-content-max);
    }
    /* R5-SYSTEM-297: the guide reads in the product's own scale - the page heading, 17/700 section titles, a body-sized lead */
    h2 {
      font-family: var(--sw-font-heading, var(--sw-font));
      font-size: var(--sw-h1, var(--sw-fs-2xl));
      font-weight: var(--sw-h1-weight, var(--sw-fw-bold));
      letter-spacing: var(--sw-h1-tracking, -0.01em);
      color: var(--sw-heading, var(--sw-text));
      margin: 0 0 4px;
    }
    h3 {
      font-size: var(--sw-fs-xl);
      margin: 26px 0 10px;
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.01em;
      color: var(--sw-heading, var(--sw-text));
    }
    .lead {
      color: var(--sw-text-2);
      margin: 0 0 12px;
      font-size: var(--sw-fs-md);
      max-inline-size: 90ch;
    }
    /* the surface ladder of HOMEFABLE / R5: the page, a hero (large radius, shadow 2 + light line), a card (shadow 1), a well (surface-2) */
    .ladder {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .ladder > div {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
    }
    .ladder .hero {
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
    }
    .ladder .card {
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
    }
    .ladder .well {
      border-radius: var(--sw-r-md);
      border-color: transparent;
      background: var(--sw-surface-2);
    }
    .ladder b {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .ladder .big {
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading, var(--sw-text));
    }
    .ladder small {
      color: var(--sw-text-2);
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
      border-radius: var(--sw-r-sm);
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
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      position: relative;
      font-size: var(--sw-fs-2xs);
    }
    .scenes span {
      position: absolute;
      inset-inline-start: 6px;
      inset-block-end: 5px;
      color: var(--sw-on-video);
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
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      font-size: var(--sw-fs-2xs);
      color: var(--sw-text-2);
    }
    .panel {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 10px;
    }
  `];

  render() {
    return html`
      <h2>${tr('ספריית רכיבים ו־tokens (v3)')}</h2>
      <p class="lead">${tr('מקור השפה החזותית: שלושת לוחות ההדמיה ב־docs/design/reference. ממשק קומפקטי (12px), משטחים לבנים על רקע קריר, מחיצות דקות, כחול אחד במשורה, ירוק רק ל"מחובר", צל שקט, סצנות מאוירות עד חיבור זרמים.')}</p>

      <h3>${tr('צבעים')}</h3>
      <div class="swatches">
        ${COLORS.map(([v, n]) => html`<div class="swatch"><div class="c" style="background:var(${v})"></div><div class="n"><span>${n}</span><span class="ltr">${v}</span></div></div>`)}
      </div>

      <h3>${tr('טיפוגרפיה (Heebo, מארח מקומית)')}</h3>
      <div class="type">
        <p style="font-size:32px;font-weight:var(--sw-fw-bold);letter-spacing:-0.03em;color:var(--sw-heading)">${tr('ספרת תצוגה 32 · 1.3 TB')}</p>
        <p style="font-size:var(--sw-h1);font-weight:var(--sw-h1-weight);letter-spacing:var(--sw-h1-tracking);color:var(--sw-heading)">${tr('כותרת עמוד 26')}</p>
        <p style="font-size:var(--sw-fs-2xl);font-weight:var(--sw-fw-bold);color:var(--sw-heading)">${tr('כותרת מצב / Hero 20')}</p>
        <p style="font-size:var(--sw-fs-xl);font-weight:var(--sw-fw-bold);color:var(--sw-heading)">${tr('כותרת כרטיס 17')}</p>
        <p style="font-size:var(--sw-fs-md);font-weight:var(--sw-fw-semibold);color:var(--sw-heading)">${tr('תווית שורה 14')}</p>
        <p>${tr('טקסט גוף 13: מפה של אתר, מבנה וקומה היא משטח העבודה המרכזי.')}</p>
        <p style="font-size:var(--sw-fs-sm);color:var(--sw-text-2)">${tr('הסבר משני 12.5')}</p>
        <p style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${tr('תווית 11 ·')} <span class="ltr">2026-09-14T08:05:38Z</span> ${tr('נשאר LTR')}</p>
      </div>

      <h3>${tr('מדרגות המשטח (עמוד · Hero · כרטיס · באר)')}</h3>
      <div class="ladder">
        <div class="hero"><b>${tr('Hero: העצם הראשי')}</b><span class="big">84</span><small>${tr('רדיוס גדול, צל 2 וקו אור עליון; אחד למסך.')}</small></div>
        <div class="card"><b>${tr('כרטיס')}</b><small>${tr('משטח, צל 1, כותרת 17/700. כל sw-card במסכי ההגדרות.')}</small></div>
        <div class="well"><b>${tr('באר')}</b><small>${tr('surface-2, בלי מתאר; שורת הגדרה, אריח התקן, מונה.')}</small></div>
      </div>

      <h3>${tr('כרטיסי KPI')}</h3>
      <div class="kpis">
        <sw-kpi icon="camera" tone="live" value="24" label=${tr('מצלמות')} detail=${tr('מחוברות')}></sw-kpi>
        <sw-kpi icon="building" value="3" label=${tr('אתרים')} detail=${tr('פעילים')} tone="neutral"></sw-kpi>
        <sw-kpi icon="bell" value="12" label=${tr('אירועים')} detail=${tr('ב־24 השעות')} tone="neutral" badge=${tr('3 חדשים')}></sw-kpi>
        <sw-kpi icon="shield" tone="stale" value=${tr('חלקי')} label=${tr('מצב מערכת')} detail=${tr('גשר לא רענן')}></sw-kpi>
      </div>

      <h3>${tr('סצנות מאוירות (מצייני מקום, לא פריימים)')}</h3>
      <div class="scenes">${SCENES.map((s) => html`<div><sw-scene kind=${s}></sw-scene><span>${s}</span></div>`)}</div>

      <h3>${tr('אריחי מצלמה')}</h3>
      <div class="grid">
        <sw-camera-tile name="כניסה ראשית" state="live" scene="entrance"></sw-camera-tile>
        <sw-camera-tile name="חדר מדרגות" state="stale" scene="corridor"></sw-camera-tile>
        <sw-camera-tile name="מסדרון מזרחי" state="offline"></sw-camera-tile>
        <sw-camera-tile name="חניה" state="forbidden"></sw-camera-tile>
      </div>

      <h3>${tr('כפתורים, צ׳יפים, טאבים')}</h3>
      <div class="row">
        <sw-button variant="primary" icon="play">${tr('ראשי')}</sw-button>
        <sw-button icon="history">${tr('משני')}</sw-button>
        <sw-button variant="ghost" icon="pin">${tr('שקוף')}</sw-button>
        <sw-button variant="danger">${tr('מסוכן')}</sw-button>
        <sw-button variant="primary" disabled>${tr('מושבת')}</sw-button>
        <sw-button size="sm">${tr('קטן')}</sw-button>
        <sw-button iconOnly icon="refresh" label=${tr('רענון')}></sw-button>
        <sw-chip selected>${tr('הכל')}</sw-chip><sw-chip dot="#ef4444">${tr('תנועה')}</sw-chip><sw-chip dot="#2f6bff">${tr('אדם')}</sw-chip><sw-chip dot="#22c55e">${tr('רכב')}</sw-chip>
        <sw-tabs .items=${[{ id: 'a', label: tr('כל האתרים'), count: 3 }, { id: 'b', label: tr('מבנים') }, { id: 'c', label: tr('מפה') }]} active="a"></sw-tabs>
        <sw-toggle checked label=${tr('מופעל')}></sw-toggle>
        <sw-avatar name="יוני"></sw-avatar>
      </div>

      <h3>${tr('תגי מצב (צורה + טקסט, לא צבע בלבד)')}</h3>
      <div class="row">${BADGES.map((k) => html`<sw-badge kind=${k}></sw-badge>`)}</div>

      <h3>${tr('ציר זמן, שלבים, קומות איזומטריות')}</h3>
      <sw-timeline .segments=${demoSegments} .events=${[{ minute: 614, kind: 'person', label: tr('אדם') }, { minute: 582, kind: 'vehicle', label: tr('רכב') }]} .cursor=${615}></sw-timeline>
      <div class="row" style="margin-block-start:10px">
        <sw-card style="flex:1;min-inline-size:280px"><sw-steps .steps=${[tr('גילוי'), tr('הגדרה'), tr('בדיקה'), tr('סיום')]} .current=${1}></sw-steps></sw-card>
        <sw-floor-iso .rooms=${demoRooms('f0')} selected></sw-floor-iso>
        <sw-floor-iso .rooms=${demoRooms('f-1')}></sw-floor-iso>
        <sw-floor-iso empty></sw-floor-iso>
      </div>

      <h3>${tr('מצבי מסך')}</h3>
      <div class="grid">
        ${PANELS.map((p) => html`<div class="panel"><sw-state-panel state=${p} actionLabel=${p === 'error' ? tr('נסה שוב') : ''}></sw-state-panel></div>`)}
      </div>

      <h3>${tr('תלת-ממד סכמטי (T087)')}</h3>
      <div data-3d-demo style="display:flex;flex-direction:column;gap:8px;max-inline-size:720px">
        ${this.demo3d.desc
          ? html`<sw-plan-3d style="block-size:360px;border:1px solid var(--sw-border);border-radius:var(--sw-r-md)" .description=${this.demo3d.desc} .selectedId=${this.demo3d.selected} .labels=${demoSceneLabels('f0')}
                .cameras=${[{ id: 'cam-1', label: 'כניסה ראשית' }, { id: 'cam-2', label: 'לובי' }]} exportName="demo-floor"
                @part-select=${(e: CustomEvent<PartSelectDetail>) => (this.demo3d = { ...this.demo3d, selected: e.detail.id })}
                @realistic-change=${(e: CustomEvent<{ on: boolean }>) => this.onRealistic(e.detail.on)}></sw-plan-3d>
              <div style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">${tr('נבחר:')} <span class="ltr" data-3d-demo-selected>${this.demo3d.selected ?? ''}</span></div>`
          : html`<div><sw-button icon="cube" data-3d-demo-load ?disabled=${!webglAvailable() || this.demo3d.loading} @click=${() => this.load3d()}>${this.demo3d.loading ? tr('טוען…') : tr('טען תצוגת 3D')}</sw-button>
              ${webglAvailable() ? nothing : html`<span data-3d-unavailable style="margin-inline-start:8px">${WEBGL_UNAVAILABLE_HE}</span>`}
              ${this.demo3d.error ? html`<span style="color:var(--sw-danger);margin-inline-start:8px">${this.demo3d.error}</span>` : nothing}</div>`}
      </div>

      <h3>${tr('אייקונים')}</h3>
      <div class="icons">${ICONS.map((i) => html`<div class="icon"><sw-icon .name=${i} size=${18}></sw-icon><span class="ltr">${i}</span></div>`)}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'styleguide-screen': StyleguideScreen;
  }
}
