import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-tabs';
import { demoBuildings, demoSites } from '../fixtures/catalog';

/** SC02 — sites and buildings (board 1 screen 2 + board 3 screen 17 campus map as a future layer). */
@customElement('explore-sites')
export class ExploreSites extends LitElement {
  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--sw-s-4);
    }
    .hero {
      block-size: 120px;
      border-radius: var(--sw-r-md);
      background: linear-gradient(135deg, var(--sw-accent-soft), var(--sw-surface-3));
      display: grid;
      place-items: center;
      color: var(--sw-accent-text);
      margin-block-end: var(--sw-s-3);
    }
    .meta {
      display: flex;
      justify-content: space-between;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      flex-wrap: wrap;
    }
    .addr {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-end: var(--sw-s-2);
    }
    .buildings {
      margin-block-start: var(--sw-s-3);
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
    }
    .buildings a {
      display: flex;
      justify-content: space-between;
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      text-decoration: none;
      font-size: var(--sw-fs-sm);
    }
    .buildings a:hover {
      background: var(--sw-surface-3);
    }
    .add {
      display: grid;
      place-items: center;
      min-block-size: 220px;
      border: 1px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      color: var(--sw-text-2);
      gap: var(--sw-s-2);
      text-align: center;
    }
  `;

  render() {
    return html`
      <sw-page heading="אתרים ומבנים" subheading="בריאות ממקורות אמיתיים בלבד · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">אתר חדש</sw-button>
        <sw-tabs .items=${[{ id: 'all', label: 'כל האתרים', count: demoSites.length }, { id: 'buildings', label: 'מבנים' }, { id: 'map', label: 'מפת אתרים' }]} active="all"></sw-tabs>
        <div class="grid">
          ${demoSites.map((s) => {
            const buildings = demoBuildings.filter((b) => b.siteId === s.id);
            return html`<sw-card interactive>
              <div class="hero"><sw-icon name="building" size=${36}></sw-icon></div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                <strong>${s.name}</strong><sw-badge kind=${s.health}></sw-badge>
              </div>
              <div class="addr">${s.address}</div>
              <div class="meta"><span>${s.buildings} מבנים</span><span>${s.online}/${s.cameras} מצלמות</span><span>${s.alerts} התראות</span></div>
              ${buildings.length
                ? html`<div class="buildings">${buildings.map((b) => html`<a href=${`#/explore/buildings/${b.id}/floors`}><span>${b.name}</span><span>${b.floors.length} קומות · <sw-icon name="chevron" size=${14}></sw-icon></span></a>`)}</div>`
                : html`<div class="buildings"><a href="#/explore/floors/f0"><span>מבנה ראשי</span><span>1 קומה</span></a></div>`}
            </sw-card>`;
          })}
          <div class="add"><sw-icon name="plus" size=${28}></sw-icon><div>הוספת אתר חדש<br /><small>יצירת מיקום חדש כדי להתחיל</small></div></div>
        </div>
      </sw-page>
    `;
  }
}
