import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-state-panel';
import { get, describeError } from '../api/client';
import { isApi } from '../api/session';
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
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const columns: TableColumn[] = [
  { key: 'time', label: 'זמן', render: (r) => html`14.09.2026 ${String(r.time)}` },
  { key: 'user', label: 'משתמש', render: (r) => html`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(r.user)} size=${24}></sw-avatar>${String(r.user)}</span>` },
  { key: 'action', label: 'פעולה', render: (r) => html`<span style=${String(r.decision).startsWith('נחסם') ? 'color:var(--sw-danger);font-weight:600' : ''}>${String(r.action)}</span>` },
  { key: 'resource', label: 'פרטים', render: (r) => html`${String(r.resource)} <span style="color:var(--sw-text-3)">· ${String(r.decision)}</span>` },
  { key: 'role', label: 'תפקיד / היקף' },
  { key: 'rev', label: 'rev', ltr: true, render: () => html`7` },
];

interface AuditRow {
  id: number;
  at: string;
  actor_user_id: string | null;
  actor_username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  decision: string;
  reason: string | null;
  request_id: string | null;
  permission_revision: number | null;
  details: Record<string, unknown>;
}

const PREFIXES: { id: string; label: string }[] = [
  { id: '', label: 'כל הפעולות' },
  { id: 'rbac.', label: 'הרשאות ותפקידים' },
  { id: 'video.', label: 'וידאו (לייב, הקלטות, ייצוא)' },
  { id: 'events.', label: 'אירועים' },
  { id: 'cases.', label: 'תיקים וראיות' },
  { id: 'ha.', label: 'פעולות Home Assistant' },
  { id: 'system.', label: 'מערכת והגדרות' },
  { id: 'plan.', label: 'תוכניות ומפות' },
];

/** CR-008 P2: where the actor came from. Local = inside the system's own UI (through תשתית המערכת). */
const CHANNELS: { id: '' | 'local' | 'remote' | 'bearer'; label: string }[] = [
  { id: '', label: 'כל הערוצים' },
  { id: 'local', label: 'מקומי (תשתית המערכת)' },
  { id: 'remote', label: 'מרחוק (Arx)' },
  { id: 'bearer', label: 'מרחוק · אסימון גישה' },
];

/** CR-008 P2 quick views: they replace the action family. */
const VIEWS: { id: '' | 'remote_sign_ins' | 'remote_refusals'; label: string }[] = [
  { id: 'remote_sign_ins', label: 'כניסות מרחוק' },
  { id: 'remote_refusals', label: 'סירובים מרחוק' },
];

/** Readable names of the remote channel's refusal reasons (the code stays visible next to them). */
const REMOTE_REASON: Record<string, string> = {
  remote_not_allowed: 'גישה מרחוק לא הופעלה',
  remote_user_inactive: 'משתמש לא פעיל',
  remote_mfa_required: 'נדרש אימות דו־שלבי',
  csrf_refused: 'בקשה ממקור זר',
  rate_limited_ip: 'יותר מדי ניסיונות מהכתובת',
  rate_limited_user: 'יותר מדי ניסיונות של המשתמש',
  token_invalid: 'אסימון לא תקף',
  token_revoked: 'הכניסה בוטלה',
  remote_session_revoked: 'כניסה שנותקה',
  remote_live_cap: 'מכסת זרמים מרחוק',
  signed_out_everywhere: 'התנתקות מכל המקומות',
  revoked_by_user: 'נותקה על ידי המשתמש',
  revoked_by_admin: 'נותקה על ידי מנהל',
  revoked_all_by_admin: 'כל הכניסות נותקו על ידי מנהל',
};

function channelOf(d: Record<string, unknown> | undefined, action: string): string {
  if (d?.via === 'bearer') return 'מרחוק · אסימון';
  if (d?.channel === 'remote' || action.startsWith('auth.remote')) return 'מרחוק';
  return 'מקומי';
}

const DECISION: Record<string, { kind: 'success' | 'danger' | 'neutral' | 'warning'; label: string }> = {
  allowed: { kind: 'success', label: 'הותר' },
  granted: { kind: 'success', label: 'הוענק' },
  denied: { kind: 'danger', label: 'נחסם' },
  refused: { kind: 'danger', label: 'סורב' },
  failed: { kind: 'warning', label: 'נכשל' },
};

const apiColumns: TableColumn[] = [
  { key: 'at', label: 'זמן', ltr: true, render: (r) => html`<span class="ltr">${new Date(String(r.at)).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>` },
  { key: 'actor', label: 'משתמש', render: (r) => html`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(r.actor_username ?? 'מערכת')} size=${24}></sw-avatar>${String(r.actor_username ?? 'מערכת')}</span>` },
  { key: 'action', label: 'פעולה', ltr: true, render: (r) => html`<span class="ltr">${String(r.action)}</span>` },
  { key: 'decision', label: 'החלטה', render: (r) => { const d = DECISION[String(r.decision)] ?? { kind: 'neutral' as const, label: String(r.decision) }; return html`<sw-badge kind=${d.kind} label=${d.label}></sw-badge>`; } },
  { key: 'resource', label: 'משאב', render: (r) => html`${r.resource_type ? html`<span style="color:var(--sw-text-3)">${String(r.resource_type)}</span> ` : nothing}<span class="ltr">${String(r.resource_id ?? '')}</span>` },
  { key: 'channel', label: 'ערוץ', render: (r) => html`<span data-audit-channel style="font-size:var(--sw-fs-xs)">${channelOf(r.details as Record<string, unknown>, String(r.action))}</span>` },
  { key: 'reason', label: 'סיבה / פרטים', render: (r) => html`${REMOTE_REASON[String(r.reason ?? '')] ? html`${REMOTE_REASON[String(r.reason)]} <span class="ltr" style="color:var(--sw-text-3)">(${String(r.reason)})</span>` : String(r.reason ?? '')}${Object.keys((r.details as Record<string, unknown>) ?? {}).length ? html` <span style="color:var(--sw-text-3)" class="ltr">${JSON.stringify(r.details).slice(0, 120)}</span>` : nothing}` },
  { key: 'permission_revision', label: 'rev', ltr: true },
];

/** SC25 — audit log (board 3 screen 21): filter dropdowns, time / user / action / details, pagination, export.
 *  With a backend: the real `audit_log` (GET /api/v1/audit), filtered by action family, user and count (F2). */
@customElement('system-audit')
export class SystemAudit extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private rows: AuditRow[] | null = null;
  @state() private error = '';
  @state() private family = '';
  @state() private actor = '';
  @state() private limit = 100;
  @state() private channel: (typeof CHANNELS)[number]['id'] = '';
  @state() private view: (typeof VIEWS)[number]['id'] | '' = '';

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) void this.load();
  }

  private async load() {
    try {
      const q = new URLSearchParams({ prefix: this.family, limit: String(this.limit) });
      if (this.actor.trim()) q.set('actor', this.actor.trim());
      if (this.channel) q.set('channel', this.channel);
      if (this.view) q.set('view', this.view);
      const r = await get<{ rows: AuditRow[] }>(`/audit?${q.toString()}`);
      this.rows = r.rows;
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
      this.rows = [];
    }
  }

  private exportCsv() {
    const rows = this.rows ?? [];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['at', 'actor', 'action', 'decision', 'resource_type', 'resource_id', 'reason', 'request_id', 'permission_revision'].join(',')];
    for (const r of rows) lines.push([r.at, r.actor_username, r.action, r.decision, r.resource_type, r.resource_id, r.reason, r.request_id, r.permission_revision].map(esc).join(','));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  private renderApi() {
    const rows = this.rows;
    return html`
      <sw-page heading="יומן אודיט" subheading="מי צפה, שינה, ייצא או שלח פעולה · actor, פעולה, החלטה, משאב, סיבה, request_id, permission_revision · אין סיסמאות או טוקנים ביומן">
        <sw-button slot="actions" icon="download" ?disabled=${!rows?.length} @click=${() => this.exportCsv()}>ייצוא CSV</sw-button>
        <div class="filters" data-audit-filters>
          <sw-field><select aria-label="פעולה" .value=${this.family} @change=${(e: Event) => { this.family = (e.target as HTMLSelectElement).value; void this.load(); }}>${PREFIXES.map((p) => html`<option value=${p.id} ?selected=${p.id === this.family}>${p.label}</option>`)}</select></sw-field>
          <sw-field><select aria-label="ערוץ" data-audit-channel-filter .value=${this.channel} @change=${(e: Event) => { this.channel = (e.target as HTMLSelectElement).value as typeof this.channel; void this.load(); }}>${CHANNELS.map((c) => html`<option value=${c.id} ?selected=${c.id === this.channel}>${c.label}</option>`)}</select></sw-field>
          ${VIEWS.map((v) => html`<sw-chip icon=${v.id === 'remote_refusals' ? 'shield' : 'user'} data-audit-view=${v.id} aria-pressed=${this.view === v.id ? 'true' : 'false'} ?selected=${this.view === v.id} @click=${() => { this.view = this.view === v.id ? '' : v.id; void this.load(); }}>${v.label}</sw-chip>`)}
          <sw-field><input type="search" placeholder="שם משתמש" aria-label="משתמש" .value=${this.actor} @change=${(e: Event) => { this.actor = (e.target as HTMLInputElement).value; void this.load(); }} /></sw-field>
          <sw-field><select aria-label="כמות" @change=${(e: Event) => { this.limit = Number((e.target as HTMLSelectElement).value); void this.load(); }}>${[100, 250, 500].map((n) => html`<option value=${n} ?selected=${n === this.limit}>${n} אחרונות</option>`)}</select></sw-field>
          <sw-button size="sm" icon="refresh" @click=${() => this.load()}>רענון</sw-button>
        </div>
        ${this.error ? html`<sw-state-panel state="error" heading="יומן האודיט לא נטען" hint=${this.error}></sw-state-panel>` : nothing}
        ${rows === null
          ? html`<sw-state-panel state="loading" heading="טוען יומן…"></sw-state-panel>`
          : rows.length
            ? html`<sw-table data-audit-table .columns=${apiColumns} .rows=${rows as unknown as Record<string, unknown>[]}></sw-table>`
            : this.error
              ? nothing
              : html`<sw-state-panel state="empty" heading="אין רשומות לסינון הזה" hint="נסה משפחת פעולות אחרת או נקה את שם המשתמש"></sw-state-panel>`}
        <div class="pager"><span>${rows ? `מציג ${rows.length} רשומות אחרונות · צפייה ממושכת נרשמת כ־start/stop` : ''}</span></div>
      </sw-page>
    `;
  }

  static styles = [css`
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
  `, bubbleChrome];

  render() {
    if (isApi()) return this.renderApi();
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
