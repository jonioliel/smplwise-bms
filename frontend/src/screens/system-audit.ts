import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-chip';
import type { TableColumn } from '../components/sw-table';
import { demoAudit } from '../fixtures/catalog';

const columns: TableColumn[] = [
  { key: 'time', label: 'זמן (אתר)' },
  { key: 'user', label: 'משתמש' },
  { key: 'action', label: 'פעולה' },
  { key: 'resource', label: 'משאב' },
  { key: 'decision', label: 'החלטה וסיבה', render: (r) => html`<sw-badge kind=${String(r.decision).startsWith('נחסם') ? 'forbidden' : 'live'} label=${String(r.decision)}></sw-badge>` },
  { key: 'role', label: 'תפקיד/היקף' },
  { key: 'rev', label: 'revision', ltr: true, render: () => html`7` },
];

/** SC25 — audit trail (board 3 screen 21): who viewed/changed/exported/acted, without secrets. */
@customElement('system-audit')
export class SystemAudit extends LitElement {
  static styles = css`
    .filters {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      align-items: center;
    }
    .filters sw-field {
      min-inline-size: 160px;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
  `;

  render() {
    return html`
      <sw-page heading="Audit trail" subheading="לכל פעולה: actor, מקור זהות, תפקיד והיקף, משאב, החלטה, request_id, permission_revision, זמן UTC · נתוני הדגמה">
        <sw-button slot="actions" icon="download">ייצוא</sw-button>
        <div class="filters">
          <sw-field><select><option>כל הפעולות</option><option>צפייה</option><option>שינוי</option><option>ייצוא</option><option>פעולת HA</option></select></sw-field>
          <sw-field><select><option>כל המשתמשים</option></select></sw-field>
          <sw-field><select><option>כל ההחלטות</option><option>הותר</option><option>נחסם</option></select></sw-field>
          <sw-field><input type="date" value="2026-09-14" data-ltr /></sw-field>
          <sw-chip icon="clock">שמירה: 180 יום</sw-chip>
        </div>
        <sw-table .columns=${columns} .rows=${demoAudit}></sw-table>
        <div class="hint">אין סיסמאות או טוקנים באודיט. לצפייה ממושכת נרשם start/stop ולא אירוע לכל פריים. ההיסטוריה נשמרת לפי מזהה גם אם המשתמש נמחק ב־HA.</div>
      </sw-page>
    `;
  }
}
