import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-steps';
import '../components/sw-field';
import '../components/sw-icon';

const STEPS = ['NVR', 'go2rtc', 'גשר HA', 'מנהל VMS ראשון', 'שעון', 'מצלמה ומפה ראשונות'];

/** SC26 — setup and mapping wizard (board 3 screen 22): tests, capabilities, no destructive discovery. */
@customElement('system-setup')
export class SystemSetup extends LitElement {
  @state() private step = 2;

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr);
      gap: var(--sw-s-4);
      align-items: start;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sw-s-3);
    }
    .check {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sw-s-2);
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .check:last-child {
      border-block-end: 0;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .foot {
      display: flex;
      justify-content: space-between;
      gap: var(--sw-s-2);
    }
    .users label {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 1023px) {
      .layout,
      .two {
        grid-template-columns: 1fr;
      }
    }
  `;

  private renderStep() {
    switch (this.step) {
      case 0:
        return html`<sw-card heading="חיבור ל־NVR">
          <div class="two">
            <sw-field label="כתובת"><input data-ltr placeholder="192.168.x.x" /></sw-field>
            <sw-field label="פורט HTTP"><input data-ltr value="80" /></sw-field>
            <sw-field label="משתמש"><input data-ltr placeholder="smplwise" /></sw-field>
            <sw-field label="סיסמה"><input type="password" data-ltr /></sw-field>
          </div>
          <div class="hint">מומלץ משתמש ייעודי לא־admin. בדיקת החיבור קוראת deviceInfo, time ו־capabilities בלבד.</div>
        </sw-card>`;
      case 1:
        return html`<sw-card heading="go2rtc חיצוני">
          <div class="two">
            <sw-field label="כתובת API"><input data-ltr value="http://…:1984" /></sw-field>
            <sw-field label="אימות API (מומלץ)"><input data-ltr placeholder="user:password" /></sw-field>
          </div>
          <div class="check"><span>גרסה</span><sw-badge kind="live" label="1.9.x"></sw-badge></div>
          <div class="check"><span>שמירת זרמים לקובץ ההגדרות</span><sw-badge kind="stale" label="כן: המוצר ישתמש במאגר slots קבוע"></sw-badge></div>
          <div class="check"><span>זרמים זרים (אינטרקום, מצלמות)</span><sw-badge kind="neutral" label="20 · לא ייגעו"></sw-badge></div>
        </sw-card>`;
      case 2:
        return html`<sw-card heading="גשר Home Assistant">
          <div class="check"><span>אינטגרציה מותקנת</span><sw-badge kind="live" label="smplwise_vms 0.1"></sw-badge></div>
          <div class="check"><span>Pairing</span><sw-badge kind="stale" label="ממתין לאישור מנהל HA"></sw-badge></div>
          <div class="check"><span>סנכרון משתמשים</span><sw-badge kind="unknown" label="טרם בוצע"></sw-badge></div>
          <div class="check"><span>Ingress: זהות משתמש מהכותרות</span><sw-badge kind="live" label="מאומת מול ה־proxy"></sw-badge></div>
          <div class="hint">ה־Bridge מספק קטלוג מצומצם ומבצע פעולות בשם המשתמש. אין קריאת config/auth/list מהדפדפן ואין קידום משתמשים.</div>
        </sw-card>`;
      case 3:
        return html`<sw-card heading="בחירת מנהל VMS ראשון">
          <div class="hint" style="margin-block-end:8px">מנהל HA מזוהה בוחר במפורש משתמש HA קיים. אין קידום אוטומטי לכל מנהלי HA; הבחירה נרשמת פעם אחת באודיט וה־bootstrap ננעל.</div>
          <div class="users">
            <label><input type="radio" name="admin" checked /> יוני (joni)</label>
            <label><input type="radio" name="admin" /> דנה (dana) — משתמשת רגילה ב־HA, מותר</label>
            <label><input type="radio" name="admin" /> יוסי (yossi)</label>
          </div>
        </sw-card>`;
      case 4:
        return html`<sw-card heading="פרופיל שעון">
          <div class="check"><span>אזור זמן האתר</span><span class="ltr">Asia/Jerusalem</span></div>
          <div class="check"><span>שעון NVR מול שרת</span><sw-badge kind="live" label="סטייה 2 שנ׳"></sw-badge></div>
          <div class="check"><span>פרשנות זמני חיפוש</span><sw-badge kind="stale" label="שעון מקומי (פרופיל דגם)"></sw-badge></div>
          <div class="hint">אין הזזה קבועה של שעות. שעון קיץ/חורף לפי התאריך המבוקש.</div>
        </sw-card>`;
      default:
        return html`<sw-card heading="מצלמה ומפה ראשונות">
          <div class="check"><span>ערוצים שהתגלו</span><span>10 (ללא נוסחת track)</span></div>
          <div class="check"><span>קומה ראשונה</span><span>קומה 0 · תוכנית: להעלות</span></div>
          <div class="hint">גילוי אינו משנה תצורה במכשיר. הצבה על המפה יוצרת Binding בלבד.</div>
        </sw-card>`;
    }
  }

  render() {
    return html`
      <sw-page heading="אשף התקנה ומיפוי" subheading="בדיקות קריאה בלבד · אין גילוי הרסני · נתוני הדגמה">
        <sw-steps .steps=${STEPS} .current=${this.step}></sw-steps>
        <div class="layout">
          <div class="stack">
            ${this.renderStep()}
            <div class="foot">
              <sw-button variant="ghost" ?disabled=${this.step === 0} @click=${() => (this.step = Math.max(0, this.step - 1))}>הקודם</sw-button>
              <sw-button variant="primary" @click=${() => (this.step = Math.min(STEPS.length - 1, this.step + 1))}>${this.step === STEPS.length - 1 ? 'סיום' : 'בדוק והמשך'}</sw-button>
            </div>
          </div>
          <sw-card heading="מצב ההתקנה">
            <div class="check"><span>Add-on</span><sw-badge kind="live" label="רץ · /data מתמשך"></sw-badge></div>
            <div class="check"><span>גיבוי</span><sw-badge kind="neutral" label="אין עדיין"></sw-badge></div>
            <div class="check"><span>panel_admin</span><sw-badge kind="neutral" label="false"></sw-badge></div>
            <div class="check"><span>משתמש רגיל דרך Ingress</span><sw-badge kind="stale" label="לבדיקה (T081)"></sw-badge></div>
          </sw-card>
        </div>
      </sw-page>
    `;
  }
}
