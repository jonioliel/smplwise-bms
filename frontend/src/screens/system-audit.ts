import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-chip';
import '../components/sw-avatar';
import '../components/sw-icon';
import type { TableColumn } from '../components/sw-table';
import { demoAudit } from '../fixtures/catalog';

const columns: TableColumn[] = [
  { key: 'time', label: 'זמן', render: (r) => html`14.09.2026 ${String(r.time)}` },
  { key: 'user', label: 'משתמש', render: (r) => html`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(r.user)} size=${24}></sw-avatar>${String(r.user)}</span>` },
  { key: 'action', label: 'פעולה', render: (r) => html`<span style=${String(r.decision).startsWith('נחסם') ? 'color:var(--sw-danger);font-weight:600' : ''}>${String(r.action)}</span>` },
  { key: 'resource', label: 'פרטים', render: (r) => html`${String(r.resource)} <span style="color:var(--sw-text-3)">· ${String(r.decision)}</span>` },
  { key: 'role', label: 'תפקיד / היקף' },
  { key: 'rev', label: 'rev', ltr: true, render: () => html`7` },
];

/** SC25 — audit log (board 3 screen 21): filter dropdowns, time / user / action / details, pagination, export. */
@customElement('system-audit')
export class SystemAudit extends LitElement {
  static styles = css`
    .filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters sw-field {
      inline-size: 150px;
    }
    .pager {
      display: flex;
      align-items: center;
      gap: 4px;
      justify-content: space-between;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .pages {
      display: inline-flex;
      gap: 4px;
    }
    .pages button {
      inline-size: 26px;
      block-size: 26px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 6px;
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .pages button.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
  `;

  render() {
    return html`
      <sw-page heading="יומן אודיט" subheading="מי צפה, שינה, ייצא או שלח פעולה · actor, מקור זהות, תפקיד והיקף, החלטה, request_id, permission_revision · נתוני הדגמה">
        <sw-button slot="actions" icon="download">ייצוא</sw-button>
        <div class="filters">
          <sw-field><select aria-label="פעולה"><option>כל הפעולות</option><option>צפייה</option><option>שינוי</option><option>ייצוא</option><option>פעולת HA</option></select></sw-field>
          <sw-field><select aria-label="משתמש"><option>כל המשתמשים</option></select></sw-field>
          <sw-field><select aria-label="אתר"><option>כל האתרים</option></select></sw-field>
          <sw-field><input type="date" value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
          <sw-chip icon="clock">שמירה: 180 יום</sw-chip>
        </div>
        <sw-table .columns=${columns} .rows=${demoAudit}></sw-table>
        <div class="pager">
          <span>מציג 1–7 מתוך 128 · אין סיסמאות או טוקנים באודיט; צפייה ממושכת נרשמת כ־start/stop</span>
          <span class="pages"><button aria-label="קודם"><sw-icon name="chevron" size=${11} flip></sw-icon></button><button class="on">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button aria-label="הבא"><sw-icon name="chevron" size=${11}></sw-icon></button></span>
        </div>
      </sw-page>
    `;
  }
}
