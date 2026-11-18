import { uiLocale } from '../i18n/locale';
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
import { settingsLadderStyles } from '../styles/settings';
import { dateInputLang } from '../api/day-format';
import { tr } from '../i18n/msg/system-a';

const columns: TableColumn[] = [
  { key: 'time', label: tr('זמן'), render: (r) => html`14.09.2026 ${String(r.time)}` },
  { key: 'user', label: tr('משתמש'), render: (r) => html`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(r.user)} size=${24}></sw-avatar>${String(r.user)}</span>` },
  { key: 'action', label: tr('פעולה'), render: (r) => html`<span style=${String(r.decision).startsWith('נחסם') ? 'color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)' : ''}>${String(r.action)}</span>` },
  { key: 'resource', label: tr('פרטים'), render: (r) => html`${String(r.resource)} <span style="color:var(--sw-text-3)">· ${String(r.decision)}</span>` },
  { key: 'role', label: tr('תפקיד / היקף') },
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
  { id: '', label: tr('כל הפעולות') },
  { id: 'rbac.', label: tr('הרשאות ותפקידים') },
  { id: 'video.', label: tr('וידאו (לייב, הקלטות, ייצוא)') },
  { id: 'events.', label: tr('אירועים') },
  { id: 'cases.', label: tr('תיקים וראיות') },
  { id: 'ha.', label: tr('פעולות Home Assistant') },
  { id: 'system.', label: tr('מערכת והגדרות') },
  { id: 'plan.', label: tr('תוכניות ומפות') },
];

/** CR-008 P2: where the actor came from. Local = inside the system's own UI (through תשתית המערכת). */
const CHANNELS: { id: '' | 'local' | 'remote' | 'bearer'; label: string }[] = [
  { id: '', label: tr('כל הערוצים') },
  { id: 'local', label: tr('מקומי (תשתית המערכת)') },
  { id: 'remote', label: tr('מרחוק (Arx)') },
  { id: 'bearer', label: tr('מרחוק · אסימון גישה') },
];

/** CR-008 P2 quick views: they replace the action family. */
const VIEWS: { id: '' | 'remote_sign_ins' | 'remote_refusals'; label: string }[] = [
  { id: 'remote_sign_ins', label: tr('כניסות מרחוק') },
  { id: 'remote_refusals', label: tr('סירובים מרחוק') },
];

/** Readable names of the remote channel's refusal reasons (the code stays visible next to them). */
const REMOTE_REASON: Record<string, string> = {
  remote_not_allowed: tr('גישה מרחוק לא הופעלה'),
  remote_user_inactive: tr('משתמש לא פעיל'),
  remote_mfa_required: tr('נדרש אימות דו־שלבי'),
  csrf_refused: tr('בקשה ממקור זר'),
  rate_limited_ip: tr('יותר מדי ניסיונות מהכתובת'),
  rate_limited_user: tr('יותר מדי ניסיונות של המשתמש'),
  token_invalid: tr('אסימון לא תקף'),
  token_revoked: tr('הכניסה בוטלה'),
  remote_session_revoked: tr('כניסה שנותקה'),
  remote_live_cap: tr('מכסת זרמים מרחוק'),
  signed_out_everywhere: tr('התנתקות מכל המקומות'),
  revoked_by_user: tr('נותקה על ידי המשתמש'),
  revoked_by_admin: tr('נותקה על ידי מנהל'),
  revoked_all_by_admin: tr('כל הכניסות נותקו על ידי מנהל'),
};

function channelOf(d: Record<string, unknown> | undefined, action: string): string {
  if (d?.via === 'bearer') return tr('מרחוק · אסימון');
  if (d?.channel === 'remote' || action.startsWith('auth.remote')) return tr('מרחוק');
  return tr('מקומי');
}

const DECISION: Record<string, { kind: 'success' | 'danger' | 'neutral' | 'warning'; label: string }> = {
  allowed: { kind: 'success', label: tr('הותר') },
  granted: { kind: 'success', label: tr('הוענק') },
  denied: { kind: 'danger', label: tr('נחסם') },
  refused: { kind: 'danger', label: tr('סורב') },
  failed: { kind: 'warning', label: tr('נכשל') },
};

const apiColumns: TableColumn[] = [
  { key: 'at', label: tr('זמן'), ltr: true, render: (r) => html`<span class="ltr">${new Date(String(r.at)).toLocaleString(uiLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>` },
  { key: 'actor', label: tr('משתמש'), render: (r) => html`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(r.actor_username ?? tr('מערכת'))} size=${24}></sw-avatar>${String(r.actor_username ?? tr('מערכת'))}</span>` },
  { key: 'action', label: tr('פעולה'), ltr: true, render: (r) => html`<span class="ltr">${String(r.action)}</span>` },
  { key: 'decision', label: tr('החלטה'), render: (r) => { const d = DECISION[String(r.decision)] ?? { kind: 'neutral' as const, label: String(r.decision) }; return html`<sw-badge kind=${d.kind} label=${d.label}></sw-badge>`; } },
  { key: 'resource', label: tr('משאב'), render: (r) => html`${r.resource_type ? html`<span style="color:var(--sw-text-3)">${String(r.resource_type)}</span> ` : nothing}<span class="ltr">${String(r.resource_id ?? '')}</span>` },
  { key: 'channel', label: tr('ערוץ'), render: (r) => html`<span data-audit-channel style="font-size:var(--sw-fs-xs)">${channelOf(r.details as Record<string, unknown>, String(r.action))}</span>` },
  { key: 'reason', label: tr('סיבה / פרטים'), render: (r) => html`${REMOTE_REASON[String(r.reason ?? '')] ? html`${REMOTE_REASON[String(r.reason)]} <span class="ltr" style="color:var(--sw-text-3)">(${String(r.reason)})</span>` : String(r.reason ?? '')}${Object.keys((r.details as Record<string, unknown>) ?? {}).length ? html` <span style="color:var(--sw-text-3);display:inline-block;max-inline-size:100%;overflow-wrap:anywhere;direction:ltr;unicode-bidi:isolate;text-align:left" class="ltr" dir="ltr" data-audit-json>${JSON.stringify(r.details).slice(0, 120)}</span>` : nothing}` },
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
      <sw-page crumbs=${tr('הגדרות')} heading=${tr('יומן אודיט')} subheading=${tr('מי צפה, שינה, ייצא או שלח פעולה · משתמש, פעולה, החלטה, משאב, סיבה ומספר בקשה · אין סיסמאות או טוקנים ביומן')}>
        <sw-button slot="actions" icon="download" ?disabled=${!rows?.length} @click=${() => this.exportCsv()}>${tr('ייצוא CSV')}</sw-button>
        <div class="filters" data-audit-filters>
          <sw-field><select aria-label=${tr('פעולה')} .value=${this.family} @change=${(e: Event) => { this.family = (e.target as HTMLSelectElement).value; void this.load(); }}>${PREFIXES.map((p) => html`<option value=${p.id} ?selected=${p.id === this.family}>${p.label}</option>`)}</select></sw-field>
          <sw-field><select aria-label=${tr('ערוץ')} data-audit-channel-filter .value=${this.channel} @change=${(e: Event) => { this.channel = (e.target as HTMLSelectElement).value as typeof this.channel; void this.load(); }}>${CHANNELS.map((c) => html`<option value=${c.id} ?selected=${c.id === this.channel}>${c.label}</option>`)}</select></sw-field>
          ${VIEWS.map((v) => html`<sw-chip icon=${v.id === 'remote_refusals' ? 'shield' : 'user'} data-audit-view=${v.id} aria-pressed=${this.view === v.id ? 'true' : 'false'} ?selected=${this.view === v.id} @click=${() => { this.view = this.view === v.id ? '' : v.id; void this.load(); }}>${v.label}</sw-chip>`)}
          <sw-field><input type="search" placeholder=${tr('שם משתמש')} aria-label=${tr('משתמש')} .value=${this.actor} @change=${(e: Event) => { this.actor = (e.target as HTMLInputElement).value; void this.load(); }} /></sw-field>
          <sw-field><select aria-label=${tr('כמות')} @change=${(e: Event) => { this.limit = Number((e.target as HTMLSelectElement).value); void this.load(); }}>${[100, 250, 500].map((n) => html`<option value=${n} ?selected=${n === this.limit}>${tr('{n} אחרונות', { n })}</option>`)}</select></sw-field>
          <sw-button size="sm" icon="refresh" @click=${() => this.load()}>${tr('רענון')}</sw-button>
        </div>
        ${this.error ? html`<sw-state-panel state="error" heading=${tr('יומן האודיט לא נטען')} hint=${this.error}></sw-state-panel>` : nothing}
        ${rows === null
          ? html`<sw-state-panel state="loading" heading=${tr('טוען יומן…')}></sw-state-panel>`
          : rows.length
            ? html`<sw-table data-audit-table .columns=${apiColumns} .rows=${rows as unknown as Record<string, unknown>[]}></sw-table>`
            : this.error
              ? nothing
              : html`<sw-state-panel icon="filter" state="empty" heading=${tr('אין רשומות לסינון הזה')} hint=${tr('נסה משפחת פעולות אחרת או נקה את שם המשתמש')}></sw-state-panel>`}
        <div class="pager"><span>${rows ? tr('מציג {n} רשומות אחרונות · צפייה ממושכת נרשמת כ־start/stop', { n: rows.length }) : ''}</span></div>
      </sw-page>
    `;
  }

  static styles = [settingsLadderStyles, css`
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
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .pages button.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    /* POLISH4-WP7 (D16): the phone layout. The filters share the width two to a line (the search field and the refresh key take a whole
       line), the table is the card list sw-table gives a phone, and the footer line wraps under its pager. */
    @media (max-width: 767px) {
      .filters {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .filters sw-field {
        inline-size: auto;
        min-inline-size: 0;
      }
      .filters sw-field:has(input[type='search']),
      .filters sw-field:has(input[type='date']),
      .filters > sw-button {
        grid-column: 1 / -1;
      }
      .pager {
        flex-wrap: wrap;
      }
    }
  `, bubbleChrome];

  render() {
    if (isApi()) return this.renderApi();
    return html`
      <sw-page crumbs=${tr('הגדרות')} heading=${tr('יומן אודיט')} subheading=${tr('מי צפה, שינה, ייצא או שלח פעולה · משתמש, תפקיד והיקף, החלטה, מספר בקשה · נתוני הדגמה')}>
        <sw-button slot="actions" icon="download">${tr('ייצוא')}</sw-button>
        <div class="filters">
          <sw-field><select aria-label=${tr('פעולה')}><option>${tr('כל הפעולות')}</option><option>${tr('צפייה')}</option><option>${tr('שינוי')}</option><option>${tr('ייצוא')}</option><option>${tr('פעולת HA')}</option></select></sw-field>
          <sw-field><select aria-label=${tr('משתמש')}><option>${tr('כל המשתמשים')}</option></select></sw-field>
          <sw-field><select aria-label=${tr('אתר')}><option>${tr('כל האתרים')}</option></select></sw-field>
          <sw-field><input type="date" lang=${dateInputLang()} value="2026-09-14" data-ltr aria-label=${tr('תאריך')} /></sw-field>
          <sw-chip icon="clock">${tr('שמירה: 180 יום')}</sw-chip>
        </div>
        <sw-table .columns=${columns} .rows=${demoAudit}></sw-table>
        <div class="pager">
          <span>${tr('מציג 1–7 מתוך 128 · אין סיסמאות או טוקנים באודיט; צפייה ממושכת נרשמת כ־start/stop')}</span>
          <span class="pages"><button aria-label=${tr('קודם')}><sw-icon name="chevron" size=${11} flip></sw-icon></button><button class="on">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button aria-label=${tr('הבא')}><sw-icon name="chevron" size=${11}></sw-icon></button></span>
        </div>
      </sw-page>
    `;
  }
}
