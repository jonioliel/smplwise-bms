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
  { id: 'health', label: 'בריאות' },
  { id: 'jobs', label: 'עבודות' },
  { id: 'backup', label: 'גיבוי ושחזור' },
  { id: 'support', label: 'תמיכה' },
];

/** SC28 — settings and diagnostics (board 3 screen 23): sectioned cards, label/control rows, toggles. */
@customElement('system-diagnostics')
export class SystemDiagnostics extends LitElement {
  @state() private tab = 'general';

  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: var(--sw-s-4);
      align-items: start;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sw-s-3);
      padding: 11px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .row .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .row .ctl {
      min-inline-size: 180px;
      max-inline-size: 260px;
      flex-shrink: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .foot {
      display: flex;
      gap: 8px;
      padding-block-start: 12px;
    }
    .jobs .bar {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      inline-size: 160px;
      overflow: hidden;
    }
    .jobs .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      inline-size: var(--p);
    }
    .jobs .bar.fail i {
      background: var(--sw-danger);
    }
    @media (max-width: 767px) {
      .row {
        flex-direction: column;
        align-items: stretch;
      }
      .row .ctl {
        max-inline-size: none;
      }
    }
  `;

  private renderGeneral() {
    return html`<div class="grid">
      <sw-card heading="זמן ומיקום" class="stack">
        <div class="row"><span class="lbl">אזור זמן לתצוגה<span class="muted">פנימית הכל UTC; שעון קיץ לפי התאריך המבוקש</span></span><sw-field class="ctl"><select><option>Asia/Jerusalem</option></select></sw-field></div>
        <div class="row"><span class="lbl">פרופיל זמן של ה־NVR<span class="muted">נקבע לפי ראיות לדגם ולקושחה</span></span><sw-field class="ctl"><select><option>hikvision · ds-76xx · שעון מקומי</option></select></sw-field></div>
        <div class="row"><span class="lbl">NTP במכשיר</span><sw-badge kind="live" label="פעיל"></sw-badge></div>
      </sw-card>
      <sw-card heading="מדיה" class="stack">
        <div class="row"><span class="lbl">כתובת go2rtc</span><sw-field class="ctl"><input data-ltr value="http://…:1984" /></sw-field></div>
        <div class="row"><span class="lbl">מאגר slots לניגון<span class="muted">שמות smplwise_pb_*; זרמים זרים לא ייגעו</span></span><sw-field class="ctl"><input data-ltr value="4" /></sw-field></div>
        <div class="row"><span class="lbl">WebRTC ברשת מקומית</span><sw-toggle checked label="מופעל"></sw-toggle></div>
        <div class="row"><span class="lbl">נפילה ל־MSE דרך Cloudflare</span><sw-toggle checked label="מופעל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="תקציבים ומגבלות" class="stack">
        <div class="row"><span class="lbl">מקסימום זרמים חיים במקביל</span><sw-field class="ctl"><input data-ltr value="8" /></sw-field></div>
        <div class="row"><span class="lbl">חיפושי NVR במקביל<span class="muted">מגבלת המכשיר: 1</span></span><sw-field class="ctl"><input data-ltr value="1" /></sw-field></div>
        <div class="row"><span class="lbl">תקרת ייצוא</span><sw-field class="ctl"><input data-ltr value="2 GB" /></sw-field></div>
      </sw-card>
      <sw-card heading="התראות" class="stack">
        <div class="row"><span class="lbl">התראה על מצלמה מנותקת<span class="muted">אחרי 5 דקות ללא הקלטה</span></span><sw-toggle checked label="מופעל"></sw-toggle></div>
        <div class="row"><span class="lbl">התראה על גשר HA לא רענן</span><sw-toggle checked label="מופעל"></sw-toggle></div>
        <div class="row"><span class="lbl">דוח יומי במייל</span><sw-toggle label="כבוי"></sw-toggle></div>
      </sw-card>
    </div>`;
  }

  private renderHealth() {
    return html`<sw-card heading="מצבים נפרדים, לא נורה אחת">${demoHealth.map((h) => html`<div class="row"><span class="lbl">${h.name}<span class="muted">${h.detail}</span></span><sw-badge kind=${h.state}></sw-badge></div>`)}
      <div class="row"><span class="lbl">הקלטה ב־NVR<span class="muted">5/10 ערוצים מקליטים כרגע (לפי תצורה)</span></span><sw-badge kind="live"></sw-badge></div>
      <div class="row"><span class="lbl">זרמים פעילים<span class="muted">4 חיים · 1 ניגון · 0 יתומים</span></span><sw-badge kind="live"></sw-badge></div>
      <div class="row"><span class="lbl">Cache חיפוש<span class="muted">כיסוי 92% ליומיים האחרונים</span></span><sw-badge kind="partial"></sw-badge></div>
    </sw-card>`;
  }

  private renderJobs() {
    return html`<sw-card heading="תור עבודות" class="jobs">${demoJobs.map((j) => html`<div class="row"><span class="lbl">${j.title}<span class="muted">${j.status}</span></span><span style="display:flex;align-items:center;gap:10px"><span class="bar ${j.status.startsWith('נכשל') ? 'fail' : ''}"><i style="--p:${j.progress}%"></i></span><span class="ltr">${j.progress}%</span></span></div>`)}</sw-card>`;
  }

  private renderBackup() {
    return html`<div class="grid">
      <sw-card heading="גיבוי" class="stack">
        <div class="row"><span class="lbl">גיבוי אחרון</span><span>אתמול 02:00 · 48 MB</span></div>
        <div class="row"><span class="lbl">תוכן</span><span class="muted">DB, מקורות תוכניות, גרסאות, עוגנים, חוקים, הגדרות</span></div>
        <div class="row"><span class="lbl">סודות וראיות</span><span class="muted">מדיניות נפרדת</span></div>
        <div class="foot"><sw-button variant="primary" icon="download">גיבוי עכשיו</sw-button><sw-button icon="upload">שחזור</sw-button></div>
      </sw-card>
      <sw-card heading="שדרוג ו־Rollback" class="stack">
        <div class="row"><span class="lbl">גרסת Add-on</span><span class="ltr">0.1.0</span></div>
        <div class="row"><span class="lbl">סכימת DB</span><span class="ltr">3</span></div>
        <div class="row"><span class="lbl">Rollback</span><span class="muted">דרך HA + שחזור גיבוי</span></div>
      </sw-card>
    </div>`;
  }

  private renderSupport() {
    return html`<sw-card heading="חבילת תמיכה מצונזרת" class="stack">
      <div class="muted" style="padding-block-end:8px">כוללת logs עם request/session/job id, מדדים, capability matrix, גרסאות. לא כוללת וידאו, תוכניות, סודות או כתובות מלאות ללא הסכמה.</div>
      <div class="row"><span class="lbl">כלול תוכניות קומה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="row"><span class="lbl">כלול תמונות מצלמה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="foot"><sw-button variant="primary" icon="download">יצירת חבילה</sw-button></div>
    </sw-card>`;
  }

  render() {
    return html`
      <sw-page heading="הגדרות ודיאגנוסטיקה" subheading="נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="check">שמור שינויים</sw-button>
        <sw-tabs .items=${TABS} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        ${this.tab === 'general' ? this.renderGeneral() : this.tab === 'health' ? this.renderHealth() : this.tab === 'jobs' ? this.renderJobs() : this.tab === 'backup' ? this.renderBackup() : this.renderSupport()}
      </sw-page>
    `;
  }
}
