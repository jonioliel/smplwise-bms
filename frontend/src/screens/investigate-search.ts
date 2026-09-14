import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-tabs';
import '../components/sw-field';
import '../components/sw-scene';
import '../components/sw-icon';

const RESULTS = [
  { scene: 'entrance', when: '14.09.2026 10:14', cam: 'כניסה ראשית', why: 'NVR: זיהוי אדם (Smart)' },
  { scene: 'lobby', when: '14.09.2026 10:13', cam: 'לובי', why: 'NVR: תנועה + סמיכות במפה לכניסה' },
  { scene: 'parking', when: '14.09.2026 06:43', cam: 'חניה מקורה', why: 'NVR: חציית קו' },
  { scene: 'entrance', when: '14.09.2026 08:12', cam: 'כניסה ראשית', why: 'HA: דלת נפתחה + תנועה' },
  { scene: 'corridor', when: '13.09.2026 23:10', cam: 'מסדרון מזרחי', why: 'NVR: זיהוי אדם' },
  { scene: 'backyard', when: '13.09.2026 18:03', cam: 'חצר אחורית', why: 'NVR: תנועה' },
] as const;

/** SC19 — AI search (board 2 screen 9, Beta): search-by pills, "search by person" card, similar matches grid. Metadata filters first; AI only with a real index. */
@customElement('investigate-search')
export class InvestigateSearch extends LitElement {
  @state() private by = 'person';

  static styles = css`
    .wrap {
      max-inline-size: 860px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .by {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .by .ref {
      inline-size: 120px;
      block-size: 90px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      position: relative;
    }
    .by .ref sw-scene {
      position: absolute;
      inset: 0;
    }
    .by .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .by b {
      display: block;
      font-size: var(--sw-fs-md);
    }
    .by p {
      margin: 2px 0 10px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .head a {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-xs);
    }
    .results {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .res {
      cursor: pointer;
    }
    .res .pic {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: var(--sw-shadow-1);
    }
    .res .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .res .pic .demo {
      position: absolute;
      inset-inline-end: 6px;
      inset-block-start: 6px;
      font-size: 9.5px;
      background: rgba(17, 24, 39, 0.5);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .res .cap {
      margin-block-start: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      line-height: 1.35;
    }
    .res .cap small {
      display: block;
      color: var(--sw-text-3);
    }
    .searchrow {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .searchrow sw-field {
      flex: 1;
    }
    @media (max-width: 767px) {
      .results {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;

  render() {
    return html`
      <sw-page heading="חיפוש AI" subheading="מצא בדיוק את מה שאתה מחפש · חיפוש סמנטי רק עם אינדקס אמיתי · נתוני הדגמה">
        <sw-badge slot="actions" kind="unknown" label="אין ספק AI מוגדר · רמה 0 (מטא־דאטה NVR)"></sw-badge>
        <div class="wrap">
          <div class="searchrow">
            <sw-field><input type="search" value="אדם בכניסה הראשית היום" aria-label="חיפוש" /></sw-field>
            <sw-button variant="primary" icon="search">חפש</sw-button>
          </div>
          <sw-tabs .items=${[{ id: 'person', label: 'אדם' }, { id: 'vehicle', label: 'רכב' }, { id: 'object', label: 'עצם' }, { id: 'color', label: 'צבע' }, { id: 'time', label: 'זמן' }, { id: 'site', label: 'אתר' }]} .active=${this.by} @change=${(e: CustomEvent<{ id: string }>) => (this.by = e.detail.id)}></sw-tabs>
          <sw-card>
            <div class="by">
              <div class="ref"><sw-scene kind="entrance"></sw-scene></div>
              <div class="txt">
                <b>חיפוש לפי ${this.by === 'person' ? 'אדם' : this.by === 'vehicle' ? 'רכב' : 'מאפיין'}</b>
                <p>מציאת הופעות של אותו אדם בכל המצלמות. פורש כ: סוג = אדם · קומה 0 · היום. זיהוי צבע, פנים או טקסט חופשי אינם פעילים עד שמוגדר ספק ומאושר dataset.</p>
                <div class="actions"><sw-button variant="primary" size="sm" icon="upload" disabled>העלאת תמונה</sw-button><sw-button size="sm" icon="aperture" disabled>השתמש בפריים הנוכחי</sw-button><sw-chip selected icon="target">אדם</sw-chip><sw-chip selected icon="floor">קומה 0</sw-chip><sw-chip selected icon="clock">היום</sw-chip></div>
              </div>
            </div>
          </sw-card>
          <div class="head"><span>התאמות (לפי מטא־דאטה)</span><a href="#/investigate/events">הצג הכל</a></div>
          <div class="results">
            ${RESULTS.map((r) => html`<div class="res" @click=${() => (window.location.hash = '#/investigate/playback')}><div class="pic"><sw-scene kind=${r.scene}></sw-scene><span class="demo">דמו</span></div><div class="cap">${r.when}<small>${r.cam} · ${r.why}</small></div></div>`)}
          </div>
        </div>
      </sw-page>
    `;
  }
}
