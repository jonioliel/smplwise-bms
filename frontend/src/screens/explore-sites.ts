import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-tabs';
import { demoBuildings, demoSites } from '../fixtures/catalog';

/** SC02 — sites (board 1 screen 2): picture-header cards with a kebab, health pill, stats row, buildings. */
@customElement('explore-sites')
export class ExploreSites extends LitElement {
  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      gap: var(--sw-s-4);
    }
    .hero {
      position: relative;
      block-size: 132px;
      background: linear-gradient(180deg, #b9d0ea 0%, #d9e6f3 38%, #9fb39a 52%, #6b8062 74%, #46553f 100%);
      display: flex;
      align-items: flex-end;
      padding: 12px 14px;
      color: #fff;
    }
    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(115deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 45%),
        linear-gradient(180deg, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.45) 100%);
    }
    .hero.b {
      background: linear-gradient(180deg, #cfd8e6 0%, #e7ecf3 40%, #a8b2c2 55%, #6a7484 78%, #3f4754 100%);
    }
    .hero.c {
      background: linear-gradient(180deg, #d9dee6 0%, #b8c0cc 42%, #7f8896 60%, #4b535f 82%, #2f353f 100%);
    }
    .hero .nm {
      position: relative;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }
    .hero .kebab {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      --sw-text-2: #fff;
      --sw-text: #fff;
      --sw-surface-3: rgba(255, 255, 255, 0.2);
    }
    .hero .demo {
      position: absolute;
      inset-inline-start: 10px;
      inset-block-start: 10px;
      font-size: 10px;
      letter-spacing: 0.04em;
      background: rgba(17, 24, 39, 0.55);
      border-radius: 4px;
      padding: 1px 6px;
    }
    .bodyc {
      padding: 12px 14px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .addr {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      text-align: center;
      padding: 8px 0;
      border-block: 1px solid var(--sw-border);
    }
    .stats b {
      display: block;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
    }
    .stats span {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .buildings {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .buildings a {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      text-decoration: none;
      font-size: var(--sw-fs-sm);
    }
    .buildings a:hover {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .buildings a span:last-child {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .add {
      display: grid;
      place-items: center;
      min-block-size: 280px;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      color: var(--sw-text-2);
      gap: var(--sw-s-2);
      text-align: center;
      cursor: pointer;
      transition: border-color var(--sw-t-fast) var(--sw-ease), background var(--sw-t-fast) var(--sw-ease);
    }
    .add:hover {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .add .ic {
      display: grid;
      place-items: center;
      inline-size: 48px;
      block-size: 48px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      margin-block-end: 6px;
    }
  `;

  render() {
    return html`
      <sw-page heading="אתרים ומבנים" subheading="בריאות ממקורות אמיתיים בלבד · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">אתר חדש</sw-button>
        <sw-tabs .items=${[{ id: 'all', label: 'כל האתרים', count: demoSites.length }, { id: 'buildings', label: 'מבנים' }, { id: 'map', label: 'מפת אתרים' }]} active="all"></sw-tabs>
        <div class="grid">
          ${demoSites.map((s, i) => {
            const buildings = demoBuildings.filter((b) => b.siteId === s.id);
            return html`<sw-card flush interactive>
              <div class="hero ${['a', 'b', 'c'][i] ?? 'a'}">
                <span class="demo">דמו</span>
                <sw-button class="kebab" variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>
                <span class="nm">${s.name}</span>
              </div>
              <div class="bodyc">
                <div class="top">
                  <span class="addr"><sw-icon name="map" size=${14}></sw-icon>${s.address}</span>
                  <sw-badge kind=${s.health}></sw-badge>
                </div>
                <div class="stats">
                  <div><b>${s.buildings}</b><span>מבנים</span></div>
                  <div><b>${s.online}/${s.cameras}</b><span>מצלמות</span></div>
                  <div><b>${s.alerts}</b><span>התראות</span></div>
                </div>
                ${buildings.length
                  ? html`<div class="buildings">${buildings.map((b) => html`<a href=${`#/explore/buildings/${b.id}/floors`}><span>${b.name}</span><span>${b.floors.length} קומות <sw-icon name="chevron" size=${14}></sw-icon></span></a>`)}</div>`
                  : html`<div class="buildings"><a href="#/explore/floors/f0"><span>מבנה ראשי</span><span>1 קומה <sw-icon name="chevron" size=${14}></sw-icon></span></a></div>`}
              </div>
            </sw-card>`;
          })}
          <div class="add" role="button" tabindex="0"><div><div class="ic"><sw-icon name="plus" size=${22}></sw-icon></div><div><strong>הוספת אתר חדש</strong><br /><small>יצירת מיקום חדש כדי להתחיל</small></div></div></div>
        </div>
      </sw-page>
    `;
  }
}
