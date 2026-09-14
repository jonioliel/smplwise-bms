import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-tabs';
import '../components/sw-floor-glyph';
import { demoBuildings } from '../fixtures/catalog';
import { navigate } from '../router';

/** SC03 — floor browser (board 1 screen 3): isometric floor stack rows, selected row outlined in blue, plan preview. */
@customElement('explore-floors')
export class ExploreFloors extends LitElement {
  @property() buildingId = 'bld-a';
  @state() private selected = 'f0';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(300px, 1fr);
      gap: var(--sw-s-4);
      align-items: start;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
    }
    .floor {
      display: flex;
      align-items: center;
      gap: var(--sw-s-4);
      padding: 12px 14px;
      border: 1.5px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      text-align: start;
      font: inherit;
      color: inherit;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    .floor:hover {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
    }
    .floor.on {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .floor .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .title {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
    }
    .counts {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-start: 2px;
    }
    .counts span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .chev {
      color: var(--sw-text-3);
    }
    .plan {
      aspect-ratio: 4 / 3;
      border-radius: var(--sw-r-md);
      background: var(--sw-map-bg);
      background-image: radial-gradient(circle, var(--sw-border) 1px, transparent 1px);
      background-size: 18px 18px;
      border: 1px solid var(--sw-border);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      overflow: hidden;
      position: relative;
    }
    .plan svg {
      inline-size: 100%;
      block-size: 100%;
    }
    .plan .open {
      position: absolute;
      inset-inline-end: 10px;
      inset-block-end: 10px;
    }
    .info dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    .info dt {
      color: var(--sw-text-3);
    }
    .info dd {
      margin: 0;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    const b = demoBuildings.find((x) => x.id === this.buildingId) ?? demoBuildings[0];
    const sel = b.floors.find((f) => f.id === this.selected) ?? b.floors[0];
    const idx = b.floors.findIndex((f) => f.id === sel.id);
    return html`
      <sw-page heading=${b.name} subheading="אתר הדגמה · ${b.floors.length} קומות · נתוני הדגמה">
        <sw-button slot="actions" icon="upload">העלאת תוכנית</sw-button>
        <sw-button slot="actions" variant="primary" icon="map" @click=${() => navigate(`/explore/floors/${sel.id}`)}>פתח מפה</sw-button>
        <sw-tabs .items=${[{ id: 'floors', label: 'קומות', count: b.floors.length }, { id: 'cameras', label: 'מצלמות', count: b.floors.reduce((n, f) => n + f.cameras, 0) }, { id: 'details', label: 'פרטים' }]} active="floors"></sw-tabs>
        <div class="layout">
          <div class="list">
            ${b.floors.map(
              (f, i) => html`<button class="floor ${f.id === sel.id ? 'on' : ''}" @click=${() => (this.selected = f.id)} @dblclick=${() => navigate(`/explore/floors/${f.id}`)} aria-pressed=${f.id === sel.id}>
                <sw-floor-glyph levels=${b.floors.length} active=${b.floors.length - 1 - i} ?selected=${f.id === sel.id} size=${52}></sw-floor-glyph>
                <div class="txt">
                  <div class="title">${f.name}</div>
                  <div class="counts">
                    <span><sw-icon name="camera" size=${13}></sw-icon>${f.cameras} מצלמות</span>
                    <span><sw-icon name="sensor" size=${13}></sw-icon>${f.entities} ישויות</span>
                    <span><sw-icon name=${f.hasPlan ? 'check' : 'upload'} size=${13}></sw-icon>${f.hasPlan ? 'תוכנית מפורסמת' : 'אין תוכנית'}</span>
                  </div>
                </div>
                <span class="chev"><sw-icon name="chevron" size=${18}></sw-icon></span>
              </button>`,
            )}
          </div>
          <div class="stack">
            <sw-card heading=${sel.name} subheading=${sel.hasPlan ? 'תצוגה מקדימה של התוכנית' : 'אין תוכנית — העלאה נדרשת'}>
              <div class="plan">
                ${sel.hasPlan
                  ? html`<svg viewBox="0 0 120 84"><rect x="8" y="8" width="104" height="68" fill="#fff" stroke="var(--sw-map-wall)" stroke-width="2" /><rect x="14" y="14" width="40" height="26" fill="none" stroke="var(--sw-map-wall)" /><rect x="60" y="14" width="46" height="26" fill="none" stroke="var(--sw-map-wall)" /><rect x="14" y="46" width="92" height="24" fill="none" stroke="var(--sw-map-wall)" /><circle cx="24" cy="26" r="3.5" fill="var(--sw-accent)" /><circle cx="84" cy="26" r="3.5" fill="var(--sw-accent)" /><circle cx="60" cy="58" r="3.5" fill="var(--sw-accent)" /></svg>`
                  : html`<sw-icon name="upload" size=${28}></sw-icon>`}
                <sw-button class="open" size="sm" variant="primary" icon="map" @click=${() => navigate(`/explore/floors/${sel.id}`)}>פתח מפה</sw-button>
              </div>
            </sw-card>
            <sw-card heading="המבנה" class="info">
              <dl>
                <dt>אתר</dt><dd>אתר הדגמה</dd>
                <dt>קומה נבחרת</dt><dd>${sel.name} (${idx + 1}/${b.floors.length})</dd>
                <dt>אזור זמן</dt><dd><span class="ltr">Asia/Jerusalem</span></dd>
                <dt>NVR</dt><dd>NVR ראשי · 10 ערוצים</dd>
                <dt>קשרים בין קומות</dt><dd>מדרגות ומעלית יוגדרו בעורך (Beta)</dd>
                <dt>בריאות</dt><dd><sw-badge kind="stale" label="1 מצלמה מנותקת"></sw-badge></dd>
              </dl>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `;
  }
}
