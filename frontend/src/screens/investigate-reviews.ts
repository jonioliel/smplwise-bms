import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-camera-tile';

const ITEMS = [
  { id: 'rv-1', title: 'כניסה ראשית · 10:12–10:16', primary: 'כניסה ראשית', related: ['לובי'], events: 3, severity: 'alert', status: 'חדש' },
  { id: 'rv-2', title: 'חצר אחורית · 09:40–09:44', primary: 'חצר אחורית', related: [], events: 2, severity: 'info', status: 'בבדיקה' },
  { id: 'rv-3', title: 'חניה מקורה · 06:41–06:45', primary: 'חניה מקורה', related: ['כניסה ראשית'], events: 1, severity: 'alert', status: 'טופל' },
  { id: 'rv-4', title: 'לובי · אתמול 23:08–23:12', primary: 'לובי', related: [], events: 4, severity: 'info', status: 'false positive' },
];

/** SC15 — review queue (legacy:review, Beta): close events grouped into windows; raw events stay reachable. */
@customElement('investigate-reviews')
export class InvestigateReviews extends LitElement {
  static styles = css`
    .filters {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--sw-s-3);
    }
    .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sw-s-2);
      margin-block: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      flex-wrap: wrap;
    }
    .actions {
      display: flex;
      gap: var(--sw-s-1);
      flex-wrap: wrap;
    }
  `;

  render() {
    return html`
      <sw-page heading="תור Review" subheading="אירועים סמוכים מקובצים לחלון אחד עם מצלמה ראשית · נתוני הדגמה">
        <div class="filters">
          <sw-chip selected count=${1}>חדש</sw-chip><sw-chip count=${1}>בבדיקה</sw-chip><sw-chip count=${1}>טופל</sw-chip><sw-chip count=${1}>false positive</sw-chip>
          <sw-chip icon="filter">חומרה</sw-chip><sw-chip icon="camera">מצלמה</sw-chip>
        </div>
        <div class="list">
          ${ITEMS.map(
            (it) => html`<sw-card>
              <sw-camera-tile compact name=${it.primary} meta=${`${it.events} אירועים`} state="recorded"></sw-camera-tile>
              <div class="meta">
                <strong>${it.title}</strong>
                <sw-badge kind=${it.status === 'חדש' ? 'stale' : it.status === 'טופל' ? 'neutral' : 'recorded'} label=${it.status}></sw-badge>
              </div>
              <div class="meta"><span>מצלמות קשורות: ${it.related.length ? it.related.join(', ') : 'אין'}</span><span>${it.severity === 'alert' ? 'התראה' : 'מידע'}</span></div>
              <div class="actions">
                <a href="#/investigate/playback"><sw-button size="sm" icon="play">נגן</sw-button></a>
                <a href="#/investigate/events"><sw-button size="sm" variant="ghost">אירועים גולמיים</sw-button></a>
                <sw-button size="sm" variant="ghost" icon="check">טופל</sw-button>
              </div>
            </sw-card>`,
          )}
        </div>
      </sw-page>
    `;
  }
}
