import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-camera-tile';
import '../components/sw-field';
import '../components/sw-tabs';
import '../components/sw-icon';
import type { TableColumn } from '../components/sw-table';
import { demoCases } from '../fixtures/catalog';
import { navigate } from '../router';

const columns: TableColumn[] = [
  { key: 'title', label: 'תיק', render: (r) => html`<strong>${String(r.title)}</strong>` },
  { key: 'status', label: 'סטטוס', render: (r) => html`<sw-badge kind=${r.status === 'פתוח' ? 'stale' : r.status === 'סגור' ? 'neutral' : 'recorded'} label=${String(r.status)}></sw-badge>` },
  { key: 'owner', label: 'בעלים' },
  { key: 'clips', label: 'קטעים' },
  { key: 'notes', label: 'הערות' },
  { key: 'preserved', label: 'ראיות שמורות', render: (r) => html`${r.preserved} שמורות${Number(r.missing) ? html` · <span style="color:var(--sw-danger)">${r.missing} חסרות</span>` : ''}` },
];

/** SC16 — cases list (board 2 screen 10, Beta). */
@customElement('investigate-cases')
export class InvestigateCases extends LitElement {
  render() {
    return html`
      <sw-page heading="תיקים" subheading="קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת ו־hash · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תיק חדש</sw-button>
        <sw-table .columns=${columns} .rows=${demoCases} @row-select=${(e: CustomEvent<{ id: string }>) => navigate(`/investigate/cases/${e.detail.id}`)}></sw-table>
      </sw-page>
    `;
  }
}

/** SC17 — case detail (board 2 screen 10): clips from several cameras, notes, suggested route, manifest. */
@customElement('investigate-case-detail')
export class InvestigateCaseDetail extends LitElement {
  @property() caseId = 'case-1';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
      gap: var(--sw-s-4);
      align-items: start;
    }
    .clips {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--sw-s-3);
    }
    .note {
      padding: var(--sw-s-2) 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .note small {
      color: var(--sw-text-3);
      display: block;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .clips {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;

  render() {
    const c = demoCases.find((x) => x.id === this.caseId) ?? demoCases[0];
    return html`
      <sw-page heading=${c.title} subheading=${`בעלים: ${c.owner} · ${c.status} · נתוני הדגמה`}>
        <sw-button slot="actions" icon="download">ייצוא חבילת ראיות</sw-button>
        <sw-button slot="actions" variant="primary" icon="check">סגירת תיק</sw-button>
        <div class="layout">
          <div class="stack">
            <sw-card heading="קטעים (לפי זמן מקור UTC, תצוגה בזמן האתר)">
              <sw-button slot="actions" size="sm" icon="plus">הוסף קטע</sw-button>
              <div class="clips">
                <sw-camera-tile compact name="כניסה ראשית 10:12" meta="שמור · hash ✓" state="recorded"></sw-camera-tile>
                <sw-camera-tile compact name="לובי 10:13" meta="שמור · hash ✓" state="recorded"></sw-camera-tile>
                <sw-camera-tile compact name="מסדרון 10:15" meta="לא שמור: NVR מחק" state="unknown"></sw-camera-tile>
              </div>
            </sw-card>
            <sw-card heading="ציר זמן ומסלול מוצע">
              <div class="hint">כניסה ראשית → לובי → מסדרון מזרחי (לפי קשרים שהוגדרו במפה). "מצלמות מוצעות לחקירה" בלבד: אין קביעה שמדובר באותו אדם.</div>
            </sw-card>
            <sw-card heading="הערות">
              <div class="note">נראה אדם נכנס אחרי פתיחת הדלת ב־10:12.<small>יוני · 10:40</small></div>
              <div class="note">לבדוק אם מסדרון מזרחי הקליט (המצלמה מנותקת מ־07:55).<small>יוסי · 10:52</small></div>
              <sw-field style="margin-block-start:8px"><textarea rows="2" placeholder="הערה חדשה…"></textarea></sw-field>
            </sw-card>
          </div>
          <div class="stack">
            <sw-card heading="פרטי התיק">
              <sw-field label="כותרת"><input value=${c.title} /></sw-field>
              <sw-field label="סטטוס"><select><option>פתוח</option><option>בבדיקה</option><option>סגור</option></select></sw-field>
              <sw-field label="משתתפים"><input value="יוני, יוסי" /></sw-field>
            </sw-card>
            <sw-card heading="Manifest">
              <div class="hint">clips 2/3 · notes 2 · requested/actual ranges · timezone Asia/Jerusalem · pipeline v0.1 · sha256 לכל קובץ. Hash מוכיח התאמה לקובץ שנשמר, לא אותנטיות מאז המצלמה.</div>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `;
  }
}
