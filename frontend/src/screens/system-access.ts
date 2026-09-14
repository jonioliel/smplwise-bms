import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-tabs';
import '../components/sw-drawer';
import '../components/sw-field';
import '../components/sw-steps';
import '../components/sw-icon';
import type { TableColumn } from '../components/sw-table';
import { demoGroups, demoRoles, demoUsers, demoAudit } from '../fixtures/catalog';

const TABS = [
  { id: 'users', label: 'משתמשים מ־HA' },
  { id: 'groups', label: 'קבוצות' },
  { id: 'roles', label: 'תפקידים' },
  { id: 'effective', label: 'הרשאות אפקטיביות' },
  { id: 'audit', label: 'אודיט' },
];

/** SC24 — HA users, VMS groups and scoped roles (board 3 screen 20; spec chapter 40 §12). */
@customElement('system-access')
export class SystemAccess extends LitElement {
  @state() private tab = 'users';
  @state() private selected: string | null = null;
  @state() private assigning = false;
  @state() private step = 0;

  static styles = css`
    .notice {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2) var(--sw-s-3);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    .roles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--sw-s-3);
    }
    .role h4 {
      margin: 0 0 6px;
    }
    .role .a {
      color: var(--sw-live);
      font-size: var(--sw-fs-sm);
    }
    .role .d {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-2);
    }
    dd {
      margin: 0;
    }
    .pill-list {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .eff {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--sw-s-3);
    }
    .eff .row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .wiz {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
  `;

  private userColumns: TableColumn[] = [
    { key: 'name', label: 'שם', render: (r) => html`<strong>${String(r.name)}</strong>${r.haAdmin ? html` <sw-badge kind="neutral" label="מנהל HA (מידע בלבד)"></sw-badge>` : ''}` },
    { key: 'haUser', label: 'משתמש HA', ltr: true },
    { key: 'active', label: 'מצב', render: (r) => html`<sw-badge kind=${r.active ? 'live' : 'offline'} label=${r.active ? 'פעיל' : 'מושבת ב־HA'}></sw-badge>` },
    { key: 'lastSync', label: 'סנכרון' },
    { key: 'groups', label: 'קבוצות', render: (r) => html`<div class="pill-list">${(r.groups as string[]).length ? (r.groups as string[]).map((g) => html`<sw-badge kind="neutral" label=${g}></sw-badge>`) : html`<span style="color:var(--sw-text-3)">ללא שיוך</span>`}</div>` },
    { key: 'bindings', label: 'תפקידי VMS', render: (r) => html`${(r.bindings as { role: string; scope: string }[]).map((b) => html`<div>${b.role} · <span style="color:var(--sw-text-2)">${b.scope}</span></div>`)}${(r.bindings as unknown[]).length ? '' : html`<span style="color:var(--sw-text-3)">—</span>`}` },
  ];

  private renderUsers() {
    const u = demoUsers.find((x) => x.id === this.selected);
    return html`
      <div class="stage">
        <sw-table .columns=${this.userColumns} .rows=${demoUsers} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => { this.selected = e.detail.id; this.assigning = false; }}></sw-table>
        ${u
          ? html`<sw-drawer open heading=${u.name} subheading=${`HA: ${u.haUser} · ${u.active ? 'פעיל' : 'מושבת'}`} @close=${() => (this.selected = null)}>
              ${this.assigning
                ? html`<div class="wiz">
                    <sw-steps .steps=${['תפקיד', 'היקף', 'תצוגה מקדימה', 'שמירה']} .current=${this.step}></sw-steps>
                    <sw-field label="קבוצה או תפקיד"><select><option>עורך מפות ותצוגות</option><option>מפעיל</option><option>צופה</option><option>מנהל אתר/מבנה/קומה</option></select></sw-field>
                    <sw-field label="היקף"><select><option>מבנה א · קומה 2</option><option>מבנה א</option><option>אתר הדגמה</option></select></sw-field>
                    <div class="eff">
                      <div><div style="font-weight:600;margin-block-end:4px">מותר בהיקף</div><div class="row"><span>עריכת תוכנית קומה 2</span><sw-icon name="check" size=${16} style="color:var(--sw-live)"></sw-icon></div><div class="row"><span>הצבת ציוד מורשה</span><sw-icon name="check" size=${16} style="color:var(--sw-live)"></sw-icon></div></div>
                      <div><div style="font-weight:600;margin-block-end:4px">לא ניתן</div><div class="row"><span>עריכת קומה 3</span><sw-icon name="close" size=${16} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>ניהול משתמשים / NVR</span><sw-icon name="close" size=${16} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>פתיחת מנעול</span><sw-icon name="close" size=${16} style="color:var(--sw-danger)"></sw-icon></div></div>
                    </div>
                    <div class="hint">הרשאות בתוך SMPLWISE בלבד. שום דבר לא נכתב ל־HA. השינוי ירשם באודיט עם diff לפני/אחרי.</div>
                  </div>`
                : html`<dl>
                    <dt>מקור זהות</dt><dd>Home Assistant · <span class="ltr">${u.haUser}</span></dd>
                    <dt>סנכרון אחרון</dt><dd>${u.lastSync}</dd>
                    <dt>קבוצות</dt><dd>${u.groups.join(', ') || '—'}</dd>
                    <dt>שיוכים</dt><dd>${u.bindings.length ? u.bindings.map((b) => html`<div>${b.role} · ${b.scope}</div>`) : 'ללא: אין גישה לתוכן'}</dd>
                  </dl>
                  <div class="hint">אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד VMS אוטומטית.</div>`}
              <div slot="footer">
                ${this.assigning
                  ? html`<sw-button variant="primary" icon="check">שמור שיוך</sw-button><sw-button variant="ghost" @click=${() => (this.assigning = false)}>ביטול</sw-button>`
                  : html`<sw-button variant="primary" icon="plus" @click=${() => { this.assigning = true; this.step = 2; }}>שיוך תפקיד</sw-button><sw-button variant="ghost" icon="shield">הרשאות אפקטיביות</sw-button>`}
              </div>
            </sw-drawer>`
          : ''}
      </div>
    `;
  }

  private renderGroups() {
    const columns: TableColumn[] = [
      { key: 'name', label: 'קבוצה', render: (r) => html`<strong>${String(r.name)}</strong>` },
      { key: 'members', label: 'חברים' },
      { key: 'bindings', label: 'שיוכים (תפקיד · היקף)', render: (r) => html`${(r.bindings as string[]).map((b) => html`<div>${b}</div>`)}` },
    ];
    return html`<sw-table .columns=${columns} .rows=${demoGroups}></sw-table><div class="hint">שיוך חבר לקבוצה מציג את כל ה־bindings שלה: קבוצה בשני אתרים אינה ניתנת לניהול בידי מי שקיבל האצלה לקומה אחת.</div>`;
  }

  private renderRoles() {
    return html`<div class="roles">${demoRoles.map((r) => html`<sw-card class="role"><h4>${r.name}</h4><div class="a">מותר: ${r.allowed}</div><div class="d">לא ניתן אוטומטית: ${r.denied}</div></sw-card>`)}</div><div class="hint">תפקידים מובנים בפיילוט; תפקידים מותאמים והאצלה מקומית ב־V1 (T082). התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.</div>`;
  }

  private renderEffective() {
    return html`
      <sw-card heading="דנה · עורכת קומה 2">
        <div class="eff">
          <div>
            <div style="font-weight:600;margin-block-end:4px">מבנה א · קומה 2</div>
            ${['מפה: קריאה', 'תוכנית: יבוא/עריכה/פרסום', 'מיקומים ותצוגות: עריכה', 'שידור חי: מצלמות מורשות'].map((x) => html`<div class="row"><span>${x}</span><sw-icon name="check" size=${16} style="color:var(--sw-live)"></sw-icon></div>`)}
          </div>
          <div>
            <div style="font-weight:600;margin-block-end:4px">מחוץ להיקף / לא מוקנה</div>
            ${['קומה 3: הכל', 'Playback וייצוא', 'ניהול משתמשים', 'הגדרות NVR / go2rtc', 'פתיחת מנעול'].map((x) => html`<div class="row"><span>${x}</span><sw-icon name="close" size=${16} style="color:var(--sw-danger)"></sw-icon></div>`)}
          </div>
        </div>
        <div class="hint" style="margin-block-start:8px">תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו. permission_revision: 7.</div>
      </sw-card>
    `;
  }

  private renderAudit() {
    const columns: TableColumn[] = [
      { key: 'time', label: 'זמן' },
      { key: 'user', label: 'משתמש' },
      { key: 'action', label: 'פעולה' },
      { key: 'resource', label: 'משאב' },
      { key: 'decision', label: 'החלטה', render: (r) => html`<sw-badge kind=${String(r.decision).startsWith('נחסם') ? 'forbidden' : 'live'} label=${String(r.decision)}></sw-badge>` },
      { key: 'role', label: 'תפקיד/היקף ששימשו' },
    ];
    return html`<sw-table dense .columns=${columns} .rows=${demoAudit.filter((a) => a.action.includes('תוכנית') || a.action.includes('סנכרון') || a.action.includes('Ingress'))}></sw-table>`;
  }

  render() {
    return html`
      <sw-page heading="משתמשים, קבוצות ותפקידים" subheading="זהות מ־Home Assistant · הרשאות בתוך SMPLWISE בלבד · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון משתמשים</sw-button>
        <div class="notice"><sw-icon name="shield" size=${18}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות.</div>
        <sw-tabs .items=${TABS} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        ${this.tab === 'users' ? this.renderUsers() : this.tab === 'groups' ? this.renderGroups() : this.tab === 'roles' ? this.renderRoles() : this.tab === 'effective' ? this.renderEffective() : this.renderAudit()}
      </sw-page>
    `;
  }
}
