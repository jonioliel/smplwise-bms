import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-tabs';
import { demoBuildings } from '../fixtures/catalog';

/** SC03 — floor browser (board 1 screen 3): stacked floors, plan thumbnails, counts, stairs/elevator later. */
@customElement('explore-floors')
export class ExploreFloors extends LitElement {
  @property() buildingId = 'bld-a';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(280px, 1fr);
      gap: var(--sw-s-4);
      align-items: start;
    }
    .floor {
      display: flex;
      align-items: center;
      gap: var(--sw-s-4);
      padding: var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      text-decoration: none;
      color: inherit;
      transition: border-color var(--sw-t-fast), box-shadow var(--sw-t-fast);
    }
    .floor:hover {
      border-color: var(--sw-accent);
      box-shadow: var(--sw-shadow-2);
    }
    .plan {
      inline-size: 120px;
      block-size: 72px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-map-bg);
      border: 1px solid var(--sw-border);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
    }
    .plan svg {
      inline-size: 100%;
      block-size: 100%;
    }
    .title {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-lg);
    }
    .counts {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
    }
    .chev {
      margin-inline-start: auto;
      color: var(--sw-text-3);
    }
    .info dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    .info dt {
      color: var(--sw-text-2);
    }
    .info dd {
      margin: 0;
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    const b = demoBuildings.find((x) => x.id === this.buildingId) ?? demoBuildings[0];
    return html`
      <sw-page heading=${b.name} subheading="אתר הדגמה · ${b.floors.length} קומות · נתוני הדגמה">
        <sw-button slot="actions" icon="upload">העלאת תוכנית</sw-button>
        <sw-tabs .items=${[{ id: 'floors', label: 'קומות', count: b.floors.length }, { id: 'cameras', label: 'מצלמות', count: b.floors.reduce((n, f) => n + f.cameras, 0) }, { id: 'details', label: 'פרטים' }]} active="floors"></sw-tabs>
        <div class="layout">
          <div class="list">
            ${b.floors.map(
              (f) => html`<a class="floor" href=${`#/explore/floors/${f.id}`}>
                <div class="plan">
                  ${f.hasPlan
                    ? html`<svg viewBox="0 0 120 72"><rect x="8" y="8" width="104" height="56" fill="#fff" stroke="var(--sw-map-wall)" stroke-width="2" /><rect x="14" y="14" width="40" height="22" fill="none" stroke="var(--sw-map-wall)" /><rect x="60" y="14" width="46" height="22" fill="none" stroke="var(--sw-map-wall)" /><rect x="14" y="42" width="92" height="16" fill="none" stroke="var(--sw-map-wall)" /></svg>`
                    : html`<sw-icon name="upload" size=${22}></sw-icon>`}
                </div>
                <div>
                  <div class="title">${f.name}</div>
                  <div class="counts">${f.cameras} מצלמות · ${f.entities} ישויות · ${f.hasPlan ? 'תוכנית מפורסמת' : 'אין תוכנית'}</div>
                </div>
                <span class="chev"><sw-icon name="chevron" size=${18}></sw-icon></span>
              </a>`,
            )}
          </div>
          <sw-card heading="המבנה" class="info">
            <dl>
              <dt>אתר</dt><dd>אתר הדגמה</dd>
              <dt>אזור זמן</dt><dd><span class="ltr">Asia/Jerusalem</span></dd>
              <dt>NVR</dt><dd>NVR ראשי · 10 ערוצים</dd>
              <dt>קשרים בין קומות</dt><dd>מדרגות ומעלית יוגדרו בעורך (Beta)</dd>
              <dt>בריאות</dt><dd><sw-badge kind="stale" label="1 מצלמה מנותקת"></sw-badge></dd>
            </dl>
          </sw-card>
        </div>
      </sw-page>
    `;
  }
}
