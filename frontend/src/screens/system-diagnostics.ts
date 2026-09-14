import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-tabs';
import '../components/sw-field';
import '../components/sw-toggle';
import { demoHealth, demoJobs } from '../fixtures/catalog';

const TABS = [
  { id: 'general', label: 'כללי' },
  { id: 'health', label: 'בריאות' },
  { id: 'jobs', label: 'עבודות' },
  { id: 'backup', label: 'גיבוי ושחזור' },
  { id: 'support', label: 'תמיכה' },
];

/** SC28 — settings and diagnostics (board 3 screen 23). */
@customElement('system-diagnostics')
export class SystemDiagnostics extends LitElement {
  @state() private tab = 'general';

  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: var(--sw-s-4);
      align-items: start;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sw-s-3);
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
  `;

  private renderGeneral() {
    return html`<div class="grid">
      <sw-card heading="זמן ומיקום" class="stack">
        <sw-field label="אזור זמן לתצוגה" hint="פנימית הכל UTC; שעון קיץ לפי התאריך המבוקש"><select><option>Asia/Jerusalem</option></select></sw-field>
        <sw-field label="פרופיל זמן של ה־NVR" hint="נקבע לפי ראיות לדגם ולקושחה"><select><option>hikvision · ds-76xx · חיפוש בשעון מקומי</option></select></sw-field>
        <div class="row" style="margin-block-start:8px"><span>NTP במכשיר</span><sw-badge kind="live" label="פעיל"></sw-badge></div>
      </sw-card>
      <sw-card heading="מדיה" class="stack">
        <sw-field label="כתובת go2rtc"><input data-ltr value="http://…:1984" /></sw-field>
        <sw-field label="מאגר slots לניגון"><input data-ltr value="4" /></sw-field>
        <div class="row"><span>WebRTC ברשת מקומית</span><sw-toggle checked label="מופעל"></sw-toggle></div>
        <div class="row"><span>נפילה ל־MSE דרך Cloudflare</span><sw-toggle checked label="מופעל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="תקציבים ומגבלות" class="stack">
        <sw-field label="מקסימום זרמים חיים במקביל"><input data-ltr value="8" /></sw-field>
        <sw-field label="חיפושי NVR במקביל"><input data-ltr value="1" /></sw-field>
        <sw-field label="תקרת ייצוא"><input data-ltr value="2 GB" /></sw-field>
      </sw-card>
    </div>`;
  }

  private renderHealth() {
    return html`<sw-card heading="מצבים נפרדים, לא נורה אחת">${demoHealth.map((h) => html`<div class="row"><span>${h.name}<div class="muted">${h.detail}</div></span><sw-badge kind=${h.state}></sw-badge></div>`)}
      <div class="row"><span>הקלטה ב־NVR<div class="muted">5/10 ערוצים מקליטים כרגע (לפי תצורה)</div></span><sw-badge kind="live"></sw-badge></div>
      <div class="row"><span>זרמים פעילים<div class="muted">4 חיים · 1 ניגון · 0 יתומים</div></span><sw-badge kind="live"></sw-badge></div>
      <div class="row"><span>Cache חיפוש<div class="muted">כיסוי 92% ליומיים האחרונים</div></span><sw-badge kind="partial"></sw-badge></div>
    </sw-card>`;
  }

  private renderJobs() {
    return html`<sw-card heading="תור עבודות">${demoJobs.map((j) => html`<div class="row"><span>${j.title}<div class="muted">${j.status}</div></span><span class="ltr">${j.progress}%</span></div>`)}</sw-card>`;
  }

  private renderBackup() {
    return html`<div class="grid">
      <sw-card heading="גיבוי" class="stack">
        <div class="row"><span>גיבוי אחרון</span><span>אתמול 02:00 · 48 MB</span></div>
        <div class="row"><span>תוכן</span><span class="muted">DB, מקורות תוכניות, גרסאות, עוגנים, חוקים, הגדרות</span></div>
        <div class="row"><span>סודות וראיות</span><span class="muted">מדיניות נפרדת</span></div>
        <div style="display:flex;gap:8px"><sw-button variant="primary" icon="download">גיבוי עכשיו</sw-button><sw-button icon="upload">שחזור</sw-button></div>
      </sw-card>
      <sw-card heading="שדרוג ו־Rollback" class="stack">
        <div class="row"><span>גרסת Add-on</span><span class="ltr">0.1.0</span></div>
        <div class="row"><span>סכימת DB</span><span class="ltr">3</span></div>
        <div class="row"><span>Rollback</span><span class="muted">דרך HA + שחזור גיבוי</span></div>
      </sw-card>
    </div>`;
  }

  private renderSupport() {
    return html`<sw-card heading="חבילת תמיכה מצונזרת" class="stack">
      <div class="muted">כוללת logs עם request/session/job id, מדדים, capability matrix, גרסאות. לא כוללת וידאו, תוכניות, סודות או כתובות מלאות ללא הסכמה.</div>
      <div class="row"><span>כלול תוכניות קומה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="row"><span>כלול תמונות מצלמה</span><sw-toggle label="לא"></sw-toggle></div>
      <div><sw-button variant="primary" icon="download">יצירת חבילה</sw-button></div>
    </sw-card>`;
  }

  render() {
    return html`
      <sw-page heading="הגדרות ודיאגנוסטיקה" subheading="נתוני הדגמה">
        <sw-tabs .items=${TABS} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        ${this.tab === 'general' ? this.renderGeneral() : this.tab === 'health' ? this.renderHealth() : this.tab === 'jobs' ? this.renderJobs() : this.tab === 'backup' ? this.renderBackup() : this.renderSupport()}
      </sw-page>
    `;
  }
}
