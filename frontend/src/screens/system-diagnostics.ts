import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-tabs';
import '../components/sw-field';
import '../components/sw-toggle';
import '../components/sw-icon';
import { demoHealth, demoJobs } from '../fixtures/catalog';

const TABS = [
  { id: 'general', label: 'כללי' },
  { id: 'media', label: 'וידאו ומדיה' },
  { id: 'health', label: 'בריאות ועבודות' },
  { id: 'backup', label: 'גיבוי ושחזור' },
  { id: 'support', label: 'תמיכה' },
];

/** SC28 — system settings (board 3 screen 23): underline tabs, sections of label / control rows, toggles, system health with "Run Diagnostics". */
@customElement('system-diagnostics')
export class SystemDiagnostics extends LitElement {
  @state() private tab = 'general';

  static styles = css`
    .sections {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-inline-size: 760px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .row .lbl {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .row .ctl {
      inline-size: 220px;
      flex-shrink: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .health {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .health .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-stale);
    }
    .foot {
      display: flex;
      gap: 8px;
      padding-block-start: 10px;
    }
    .bar {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      inline-size: 140px;
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      inline-size: var(--p);
    }
    .bar.fail i {
      background: var(--sw-danger);
    }
    @media (max-width: 767px) {
      .row {
        flex-direction: column;
        align-items: stretch;
      }
      .row .ctl {
        inline-size: auto;
      }
    }
  `;

  private renderGeneral() {
    return html`<div class="sections">
      <sw-card heading="זמן ומיקום">
        <div class="row"><span class="lbl">אזור זמן לתצוגה<span class="muted">פנימית הכל UTC; שעון קיץ לפי התאריך המבוקש</span></span><sw-field class="ctl"><select><option>(UTC+02:00) Asia/Jerusalem</option></select></sw-field></div>
        <div class="row"><span class="lbl">פרופיל זמן של ה־NVR<span class="muted">נקבע לפי ראיות לדגם ולקושחה</span></span><sw-field class="ctl"><select><option>hikvision · ds-76xx · שעון מקומי</option></select></sw-field></div>
        <div class="row"><span class="lbl">NTP במכשיר<span class="muted">pool.ntp.org · סטייה 2 שנ׳</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="מדיניות אחסון (קריאה מה־NVR)">
        <div class="row"><span class="lbl">שמירת הקלטות</span><sw-field class="ctl"><select disabled><option>לפי מקום פנוי (overwrite)</option></select></sw-field></div>
        <div class="row"><span class="lbl">כשהאחסון מתמלא</span><sw-field class="ctl"><select disabled><option>דריסת הישן ביותר</option></select></sw-field></div>
        <div class="row"><span class="lbl">התראת אחסון נמוך<span class="muted">מתחת ל־10% פנוי</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="אינטגרציות">
        <div class="row"><span class="lbl">go2rtc (חיצוני)<span class="muted">מאגר slots בשם smplwise_* · זרמים זרים לא ייגעו</span></span><span style="display:flex;gap:8px;align-items:center"><sw-toggle checked label="מופעל"></sw-toggle><sw-button size="sm">הגדרה</sw-button></span></div>
        <div class="row"><span class="lbl">גשר Home Assistant<span class="muted">קטלוג ישויות ופעולות בשם המשתמש</span></span><span style="display:flex;gap:8px;align-items:center"><sw-toggle checked label="מופעל"></sw-toggle><sw-button size="sm">הגדרה</sw-button></span></div>
      </sw-card>
      <sw-card heading="בריאות המערכת">
        <div class="row"><span class="health"><i class="dot"></i><span class="lbl">מצב חלקי<span class="muted">גשר HA לא רענן · 1 מצלמה מנותקת · שאר הרכיבים תקינים</span></span></span><sw-button size="sm" icon="activity">הרצת דיאגנוסטיקה</sw-button></div>
      </sw-card>
    </div>`;
  }

  private renderMedia() {
    return html`<div class="sections">
      <sw-card heading="מדיה">
        <div class="row"><span class="lbl">כתובת go2rtc</span><sw-field class="ctl"><input data-ltr value="http://…:1984" /></sw-field></div>
        <div class="row"><span class="lbl">מאגר slots לניגון</span><sw-field class="ctl"><input data-ltr value="4" /></sw-field></div>
        <div class="row"><span class="lbl">WebRTC ברשת מקומית</span><sw-toggle checked label="מופעל"></sw-toggle></div>
        <div class="row"><span class="lbl">נפילה ל־MSE דרך Cloudflare</span><sw-toggle checked label="מופעל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="תקציבים ומגבלות">
        <div class="row"><span class="lbl">מקסימום זרמים חיים במקביל</span><sw-field class="ctl"><input data-ltr value="8" /></sw-field></div>
        <div class="row"><span class="lbl">חיפושי NVR במקביל<span class="muted">מגבלת המכשיר: 1</span></span><sw-field class="ctl"><input data-ltr value="1" /></sw-field></div>
        <div class="row"><span class="lbl">תקרת ייצוא</span><sw-field class="ctl"><input data-ltr value="2 GB" /></sw-field></div>
      </sw-card>
    </div>`;
  }

  private renderHealth() {
    return html`<div class="sections">
      <sw-card heading="מצבים נפרדים, לא נורה אחת">${demoHealth.map((h) => html`<div class="row"><span class="lbl">${h.name}<span class="muted">${h.detail}</span></span><sw-badge kind=${h.state}></sw-badge></div>`)}
        <div class="row"><span class="lbl">הקלטה ב־NVR<span class="muted">5/10 ערוצים מקליטים כרגע (לפי תצורה)</span></span><sw-badge kind="live"></sw-badge></div>
        <div class="row"><span class="lbl">זרמים פעילים<span class="muted">4 חיים · 1 ניגון · 0 יתומים</span></span><sw-badge kind="live"></sw-badge></div>
      </sw-card>
      <sw-card heading="תור עבודות">${demoJobs.map((j) => html`<div class="row"><span class="lbl">${j.title}<span class="muted">${j.status}</span></span><span style="display:flex;align-items:center;gap:10px"><span class="bar ${j.status.startsWith('נכשל') ? 'fail' : ''}"><i style="--p:${j.progress}%"></i></span><span class="ltr">${j.progress}%</span></span></div>`)}</sw-card>
    </div>`;
  }

  private renderBackup() {
    return html`<div class="sections">
      <sw-card heading="גיבוי">
        <div class="row"><span class="lbl">גיבוי אחרון</span><span>אתמול 02:00 · 48 MB</span></div>
        <div class="row"><span class="lbl">תוכן</span><span class="muted">DB, מקורות תוכניות, גרסאות, עוגנים, חוקים, הגדרות</span></div>
        <div class="row"><span class="lbl">סודות וראיות</span><span class="muted">מדיניות נפרדת</span></div>
        <div class="foot"><sw-button variant="primary" icon="download">גיבוי עכשיו</sw-button><sw-button icon="upload">שחזור</sw-button></div>
      </sw-card>
      <sw-card heading="שדרוג ו־Rollback">
        <div class="row"><span class="lbl">גרסת Add-on</span><span class="ltr">0.1.0</span></div>
        <div class="row"><span class="lbl">סכימת DB</span><span class="ltr">3</span></div>
        <div class="row"><span class="lbl">Rollback</span><span class="muted">דרך HA + שחזור גיבוי</span></div>
      </sw-card>
    </div>`;
  }

  private renderSupport() {
    return html`<div class="sections"><sw-card heading="חבילת תמיכה מצונזרת">
      <div class="muted" style="padding-block-end:8px">כוללת logs עם request/session/job id, מדדים, capability matrix, גרסאות. לא כוללת וידאו, תוכניות, סודות או כתובות מלאות ללא הסכמה.</div>
      <div class="row"><span class="lbl">כלול תוכניות קומה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="row"><span class="lbl">כלול תמונות מצלמה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="foot"><sw-button variant="primary" icon="download">יצירת חבילה</sw-button></div>
    </sw-card></div>`;
  }

  render() {
    return html`
      <sw-page heading="הגדרות המערכת" subheading="אזור זמן, מדיניות אחסון, אינטגרציות ובריאות · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="check">שמור שינויים</sw-button>
        <sw-tabs underline .items=${TABS} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        ${this.tab === 'general' ? this.renderGeneral() : this.tab === 'media' ? this.renderMedia() : this.tab === 'health' ? this.renderHealth() : this.tab === 'backup' ? this.renderBackup() : this.renderSupport()}
      </sw-page>
    `;
  }
}
