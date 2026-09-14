import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-tabs';
import '../components/sw-scene';
import '../components/sw-floor-iso';
import { demoBuildings, demoSites } from '../fixtures/catalog';
import { demoRooms } from '../fixtures/demo';
import { navigate } from '../router';

/** SC03 — floor browser (board 1 screen 3): building header with picture, tabs, rows with isometric floor drawings. */
@customElement('explore-floors')
export class ExploreFloors extends LitElement {
  @property() buildingId = 'bld-a';
  @state() private selected = 'f0';
  @state() private tab = 'floors';

  static styles = css`
    .pic {
      inline-size: 112px;
      block-size: 72px;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      position: relative;
      box-shadow: var(--sw-shadow-1);
    }
    .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-inline-size: 720px;
    }
    .floor {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 14px;
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
      margin-block-start: 2px;
    }
    .chev {
      color: var(--sw-text-3);
    }
    .floor.on .chev {
      color: var(--sw-accent);
    }
    .cams {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
      max-inline-size: 520px;
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
  `;

  render() {
    const b = demoBuildings.find((x) => x.id === this.buildingId) ?? demoBuildings[0];
    const site = demoSites.find((s) => s.id === b.siteId) ?? demoSites[0];
    const sel = b.floors.find((f) => f.id === this.selected) ?? b.floors[0];
    const totalCams = b.floors.reduce((n, f) => n + f.cameras, 0);
    return html`
      <sw-page heading=${b.name} subheading=${`${site.address} · ${site.name} · נתוני הדגמה`} crumbs=${`אתרים | ${site.name} | ${b.name}`}>
        <div slot="actions" class="pic"><sw-scene kind="building"></sw-scene></div>
        <sw-tabs .items=${[{ id: 'floors', label: 'קומות', count: b.floors.length }, { id: 'cameras', label: 'מצלמות', count: totalCams }, { id: 'details', label: 'פרטים' }]} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        ${this.tab === 'floors'
          ? html`<div class="list">
              ${b.floors.map(
                (f) => html`<button class="floor ${f.id === sel.id ? 'on' : ''}" @click=${() => (this.selected === f.id ? navigate(`/explore/floors/${f.id}`) : (this.selected = f.id))} aria-pressed=${f.id === sel.id}>
                  <div class="txt">
                    <div class="title">${f.name}</div>
                    <div class="counts">${f.cameras} מצלמות · ${f.entities} ישויות${f.hasPlan ? '' : ' · אין תוכנית עדיין'}</div>
                  </div>
                  <sw-floor-iso .rooms=${demoRooms(f.id)} ?selected=${f.id === sel.id} ?empty=${!f.hasPlan} width=${128}></sw-floor-iso>
                  <span class="chev"><sw-icon name="chevron" size=${16}></sw-icon></span>
                </button>`,
              )}
              <div style="display:flex;gap:8px;justify-content:flex-end">
                <sw-button icon="upload" @click=${() => navigate(`/explore/floors/${sel.id}/import`)}>העלאת תוכנית</sw-button>
                <sw-button variant="primary" icon="map" @click=${() => navigate(`/explore/floors/${sel.id}`)}>פתח את ${sel.name}</sw-button>
              </div>
            </div>`
          : this.tab === 'cameras'
            ? html`<div class="cams">${b.floors.map((f) => html`<sw-card heading=${f.name} subheading="${f.cameras} מצלמות" interactive @click=${() => navigate(`/explore/floors/${f.id}`)}></sw-card>`)}</div>`
            : html`<sw-card heading="פרטי המבנה">
                <dl>
                  <dt>אתר</dt><dd>${site.name}</dd>
                  <dt>כתובת</dt><dd>${site.address}</dd>
                  <dt>אזור זמן</dt><dd><span class="ltr">Asia/Jerusalem</span></dd>
                  <dt>NVR</dt><dd>NVR ראשי · 10 ערוצים</dd>
                  <dt>קשרים בין קומות</dt><dd>מדרגות ומעלית יוגדרו בעורך (Beta)</dd>
                  <dt>בריאות</dt><dd><sw-badge kind="stale" label="1 מצלמה מנותקת"></sw-badge></dd>
                </dl>
              </sw-card>`}
      </sw-page>
    `;
  }
}
