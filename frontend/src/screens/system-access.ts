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
import '../components/sw-avatar';
import type { TableColumn } from '../components/sw-table';
import { demoGroups, demoRoles, demoUsers, demoAudit } from '../fixtures/catalog';

const TABS = [
  { id: 'users', label: 'משתמשים', count: demoUsers.length },
  { id: 'groups', label: 'קבוצות', count: demoGroups.length },
  { id: 'roles', label: 'תפקידים', count: demoRoles.length },
  { id: 'effective', label: 'הרשאות אפקטיביות' },
  { id: 'audit', label: 'אודיט הרשאות' },
];

/** SC24 — user roles & permissions (board 3 screen 20): avatar rows, role and scope pills, status dot, ⋯; identity from HA only. */
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
      gap: 8px;
      padding: 8px 12px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-xs);
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .who .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: start;
    }
    .pillsel {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 7px;
      padding: 3px 8px;
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface);
      color: var(--sw-text);
      white-space: nowrap;
    }
    .pillsel sw-icon {
      color: var(--sw-text-3);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
    }
    .status i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .status.off i {
      background: var(--sw-offline);
    }
    .roles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .role h4 {
      margin: 0 0 6px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-md);
    }
    .role .ic {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 8px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    .role .a {
      color: #15803d;
      font-size: var(--sw-fs-xs);
    }
    .role .d {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    .eff {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .eff .row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-xs);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .wiz {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `;

  private userColumns: TableColumn[] = [
    { key: 'name', label: 'שם', render: (r) => html`<div class="who"><sw-avatar name=${String(r.name)} size=${30}></sw-avatar><div><strong>${String(r.name)}</strong>${r.haAdmin ? html` <sw-badge kind="neutral" label="מנהל HA · מידע בלבד"></sw-badge>` : ''}<div class="ltr sub">${String(r.haUser)}@ha.local</div></div></div>` },
    { key: 'role', label: 'תפקיד', render: (r) => { const b = (r.bindings as { role: string; scope: string }[])[0]; return b ? html`<span class="pillsel">${b.role}<sw-icon name="chevronDown" size=${11}></sw-icon></span>` : html`<span class="pillsel" style="color:var(--sw-text-3)">ללא שיוך<sw-icon name="chevronDown" size=${11}></sw-icon></span>`; } },
    { key: 'scope', label: 'היקף גישה', render: (r) => { const b = (r.bindings as { role: string; scope: string }[])[0]; return b ? html`<span class="pillsel">${b.scope}<sw-icon name="chevronDown" size=${11}></sw-icon></span>` : html`<span class="sub">—</span>`; } },
    { key: 'active', label: 'מצב', render: (r) => html`<span class="status ${r.active ? '' : 'off'}"><i></i>${r.active ? 'פעיל' : 'מושבת ב־HA'}</span>` },
    { key: 'lastSync', label: 'סנכרון' },
    { key: 'more', label: '', width: '40px', render: () => html`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>` },
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
                      <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מותר בהיקף</div><div class="row"><span>עריכת תוכנית קומה 2</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div><div class="row"><span>הצבת ציוד מורשה</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div></div>
                      <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">לא ניתן</div><div class="row"><span>עריכת קומה 3</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>ניהול משתמשים / NVR</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>פתיחת מנעול</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
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
                  ? html`<sw-button variant="primary" size="sm" icon="check">שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${() => (this.assigning = false)}>ביטול</sw-button>`
                  : html`<sw-button variant="primary" size="sm" icon="plus" @click=${() => { this.assigning = true; this.step = 2; }}>שיוך תפקיד</sw-button><sw-button variant="ghost" size="sm" icon="shield">הרשאות אפקטיביות</sw-button>`}
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
      { key: 'more', label: '', width: '40px', render: () => html`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>` },
    ];
    return html`<sw-table .columns=${columns} .rows=${demoGroups}></sw-table><div class="hint">שיוך חבר לקבוצה מציג את כל ה־bindings שלה: קבוצה בשני אתרים אינה ניתנת לניהול בידי מי שקיבל האצלה לקומה אחת.</div>`;
  }

  private renderRoles() {
    return html`<div class="roles">${demoRoles.map((r) => html`<sw-card class="role"><h4><span class="ic"><sw-icon name=${r.id === 'viewer' ? 'eye' : r.id === 'operator' ? 'play' : r.id === 'editor' ? 'edit' : r.id === 'site_admin' ? 'building' : 'shield'} size=${14}></sw-icon></span>${r.name}</h4><div class="a">מותר: ${r.allowed}</div><div class="d">לא ניתן אוטומטית: ${r.denied}</div></sw-card>`)}</div><div class="hint">תפקידים מובנים בפיילוט; תפקידים מותאמים והאצלה מקומית ב־V1 (T082). התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.</div>`;
  }

  private renderEffective() {
    return html`
      <sw-card heading="דנה · עורכת קומה 2">
        <div class="eff">
          <div>
            <div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מבנה א · קומה 2</div>
            ${['מפה: קריאה', 'תוכנית: יבוא/עריכה/פרסום', 'מיקומים ותצוגות: עריכה', 'שידור חי: מצלמות מורשות'].map((x) => html`<div class="row"><span>${x}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}
          </div>
          <div>
            <div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מחוץ להיקף / לא מוקנה</div>
            ${['קומה 3: הכל', 'Playback וייצוא', 'ניהול משתמשים', 'הגדרות NVR / go2rtc', 'פתיחת מנעול'].map((x) => html`<div class="row"><span>${x}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}
          </div>
        </div>
        <div class="hint" style="margin-block-start:8px">תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו. permission_revision: 7.</div>
      </sw-card>
    `;
  }

  private renderAudit() {
    const columns: TableColumn[] = [
      { key: 'time', label: 'זמן' },
      { key: 'user', label: 'משתמש', render: (r) => html`<div class="who"><sw-avatar name=${String(r.user)} size=${24}></sw-avatar>${String(r.user)}</div>` },
      { key: 'action', label: 'פעולה' },
      { key: 'resource', label: 'משאב' },
      { key: 'decision', label: 'החלטה', render: (r) => html`<sw-badge kind=${String(r.decision).startsWith('נחסם') ? 'forbidden' : 'live'} label=${String(r.decision)}></sw-badge>` },
      { key: 'role', label: 'תפקיד/היקף ששימשו' },
    ];
    return html`<sw-table dense .columns=${columns} .rows=${demoAudit.filter((a) => a.action.includes('תוכנית') || a.action.includes('סנכרון') || a.action.includes('Ingress'))}></sw-table>`;
  }

  render() {
    return html`
      <sw-page heading="משתמשים והרשאות" subheading="זהות מ־Home Assistant · הרשאות בתוך SMPLWISE בלבד · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון משתמשים מ־HA</sw-button>
        <sw-tabs .items=${TABS} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות. אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.</div>
        ${this.tab === 'users' ? this.renderUsers() : this.tab === 'groups' ? this.renderGroups() : this.tab === 'roles' ? this.renderRoles() : this.tab === 'effective' ? this.renderEffective() : this.renderAudit()}
      </sw-page>
    `;
  }
}
