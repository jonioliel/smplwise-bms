import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-tabs';
import '../components/sw-scene';
import { demoBuildings, demoSites } from '../fixtures/catalog';
import { navigate } from '../router';

const SITE_SCENE = ['house', 'building', 'warehouse'] as const;

/** SC02 — sites & buildings (board 1 screen 2): picture cards with name, ⋯ menu and "N buildings · M cameras". */
@customElement('explore-sites')
export class ExploreSites extends LitElement {
  @state() private tab = 'all';

  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 14px;
    }
    .pic {
      position: relative;
      aspect-ratio: 16 / 10;
      overflow: hidden;
    }
    .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .pic .demo {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: 9.5px;
      letter-spacing: 0.04em;
      background: rgba(17, 24, 39, 0.5);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .pic sw-badge {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
    }
    .info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px 12px;
    }
    .info b {
      display: block;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .info small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .add {
      display: grid;
      place-items: center;
      min-block-size: 200px;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      color: var(--sw-text-2);
      text-align: center;
      cursor: pointer;
      transition: border-color var(--sw-t-fast) var(--sw-ease), background var(--sw-t-fast) var(--sw-ease);
      font-size: var(--sw-fs-sm);
    }
    .add:hover {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .add .ic {
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin: 0 auto 8px;
    }
    .add small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .blist {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .brow {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }
    .brow sw-scene {
      inline-size: 64px;
      block-size: 44px;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .brow b {
      display: block;
      font-weight: var(--sw-fw-semibold);
    }
    .brow small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .brow sw-icon {
      margin-inline-start: auto;
      color: var(--sw-text-3);
    }
    .map {
      min-block-size: 360px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
  `;

  private renderSites() {
    return html`<div class="grid">
      ${demoSites.map(
        (s, i) => html`<sw-card flush interactive @click=${() => navigate(`/explore/buildings/${demoBuildings.find((b) => b.siteId === s.id)?.id ?? 'bld-a'}/floors`)}>
          <div class="pic"><sw-scene kind=${SITE_SCENE[i] ?? 'building'}></sw-scene><span class="demo">דמו</span><sw-badge onImage kind=${s.health}></sw-badge></div>
          <div class="info">
            <div><b>${s.name}</b><small>${s.buildings} ${s.buildings === 1 ? 'מבנה' : 'מבנים'} · ${s.cameras} מצלמות</small></div>
            <sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד" @click=${(e: Event) => e.stopPropagation()}></sw-button>
          </div>
        </sw-card>`,
      )}
      <div class="add" role="button" tabindex="0"><div><div class="ic"><sw-icon name="plus" size=${18}></sw-icon></div><strong>הוספת אתר חדש</strong><small>יצירת מיקום חדש כדי להתחיל</small></div></div>
    </div>`;
  }

  private renderBuildings() {
    return html`<div class="blist">
      ${demoBuildings.map(
        (b, i) => html`<sw-card class="brow" @click=${() => navigate(`/explore/buildings/${b.id}/floors`)}>
          <sw-scene kind=${i % 2 ? 'house' : 'building'}></sw-scene>
          <div><b>${b.name}</b><small>${demoSites.find((s) => s.id === b.siteId)?.name} · ${b.floors.length} קומות · ${b.floors.reduce((n, f) => n + f.cameras, 0)} מצלמות</small></div>
          <sw-icon name="chevron" size=${14}></sw-icon>
        </sw-card>`,
      )}
    </div>`;
  }

  render() {
    return html`
      <sw-page heading="אתרים ומבנים" subheading="ניהול המיקומים והמבנים שלך · בריאות ממקורות אמיתיים בלבד · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">אתר חדש</sw-button>
        <sw-tabs .items=${[{ id: 'all', label: 'כל האתרים', count: demoSites.length }, { id: 'buildings', label: 'מבנים', count: demoBuildings.length }, { id: 'map', label: 'מפה' }]} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        ${this.tab === 'all' ? this.renderSites() : this.tab === 'buildings' ? this.renderBuildings() : html`<div class="map">מפת אתרים (לוח 3 · מסך 17) תצטרף עם שכבת מיקום גאוגרפי · Beta</div>`}
      </sw-page>
    `;
  }
}
