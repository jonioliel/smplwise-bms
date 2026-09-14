import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-field';
import '../components/sw-camera-tile';

/** SC19 — spatial search (board 2 screen 9, Beta): metadata filters first; AI only with a real index. */
@customElement('investigate-search')
export class InvestigateSearch extends LitElement {
  static styles = css`
    .box {
      display: flex;
      gap: var(--sw-s-2);
      align-items: center;
      flex-wrap: wrap;
    }
    .box sw-field {
      flex: 1;
      min-inline-size: 260px;
    }
    .chips {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .results {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--sw-s-3);
    }
    .why {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 4px;
    }
    .coverage {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
  `;

  render() {
    return html`
      <sw-page heading="חיפוש" subheading="״אדם בקומת מחסנים אתמול״ מתורגם לפילטרים מאומתים · חיפוש סמנטי רק עם אינדקס אמיתי · נתוני הדגמה">
        <div class="box">
          <sw-field><input type="search" value="אדם בכניסה הראשית היום" /></sw-field>
          <sw-button variant="primary" icon="search">חפש</sw-button>
        </div>
        <div class="chips">
          <sw-chip selected icon="target">אדם</sw-chip><sw-chip>רכב</sw-chip><sw-chip>תנועה</sw-chip><sw-chip selected icon="floor">קומה 0</sw-chip><sw-chip selected icon="clock">היום</sw-chip><sw-chip icon="camera">כניסה ראשית</sw-chip>
        </div>
        <div class="coverage">פורש כ: סוג = אדם · קומה 0 · 00:00–עכשיו. כיסוי אינדקס: מטא־דאטה של ה־NVR בלבד (רמה 0). זיהוי צבע, פנים או טקסט חופשי אינם פעילים.</div>
        <div class="results">
          ${[
            { name: 'כניסה ראשית', when: '10:14', why: 'NVR: זיהוי אדם (Smart)' },
            { name: 'לובי', when: '10:13', why: 'NVR: תנועה + סמיכות במפה לכניסה' },
            { name: 'כניסה ראשית', when: '08:12', why: 'HA: דלת נפתחה + תנועה' },
            { name: 'לובי', when: 'אתמול 23:10', why: 'NVR: זיהוי אדם' },
          ].map((r) => html`<div><sw-camera-tile compact name=${r.name} meta=${r.when} state="recorded"></sw-camera-tile><div class="why">למה התאים: ${r.why}</div></div>`)}
        </div>
        <sw-card heading="ניתוח מתקדם (כבוי)">
          <sw-badge kind="unknown" label="אין ספק AI מוגדר"></sw-badge>
          <div class="why">רמה 1–3 (העשרה, סמנטי, התאמה בין מצלמות) מותנות ב־dataset מאושר, מדידת דיוק, תקציב ופרטיות. אין הצגת יכולת רק כי יש כפתור בהדמיה.</div>
        </sw-card>
      </sw-page>
    `;
  }
}
