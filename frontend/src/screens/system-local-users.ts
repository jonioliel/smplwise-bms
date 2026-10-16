import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-card';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import { apiUrl, del, describeError, get, patch, post, put } from '../api/client';
import { fmtWhen, type RoleInfo, type ScopeRef } from '../api/access';
import { lit, type LocalIdentityKey } from '../i18n/local-identity';

/** USR2: one Arx-only identity as GET /identity/local-users lists it (never a hash, never a link). */
export interface LocalUser {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  notes: string | null;
  status: 'pending_first_login' | 'active' | 'delayed' | 'disabled' | 'deleted';
  active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  last_sign_in_from: string | null;
  role_id: string | null;
  role_name: string | null;
  scope_type: string | null;
  scope_id: string | null;
  scope_name: string | null;
  admin: boolean;
  second_factor: boolean;
  reset_mode: 'manager_only' | 'self_service';
  must_change_password: boolean;
  sessions: number;
  ha_user_id: string | null;
  /** USR2 phase 2: the user's WhatsApp number when it is VERIFIED (masked: the last two digits). */
  whatsapp?: { verified: boolean; masked: string | null };
  /** Why a self-service reset would be refused right now (null = it would work, or the mode is manager_only). */
  self_service_blocked?: 'admin_target' | 'no_verified_number' | null;
}

export interface LocalUsersReply {
  enabled: boolean;
  can_manage: boolean;
  channel: 'local' | 'remote';
  users: LocalUser[];
  /** USR2 phase 2: a WhatsApp account is mapped for the reset use and connected. */
  whatsapp_ready?: boolean;
  /** Where links sent by WhatsApp point (the configured address, or this remote session's host), or null. */
  public_url?: string | null;
}

/** USR2 phase 2: a link that went by WhatsApp - nothing secret is shown, only where and until when. */
interface LinkSent {
  user: string;
  to: string;
  expires_at: string;
}

interface LinkShown {
  user: string;
  purpose: 'first_login' | 'reset';
  path: string;
  url?: string | null;
  expires_at: string;
}

// sw-table renders the rows in its own shadow root: the cells carry their styles inline (this component's sheet never reaches them)
const CELL = 'display:flex;flex-direction:column;gap:2px;align-items:flex-start';
const MUTED = 'color:var(--sw-text-3);font-size:var(--sw-fs-xs)';
const BADGES = 'display:flex;flex-wrap:wrap;gap:4px';

/** The permissions that make a role administrative for a local identity (rbac.LOCAL_ADMIN_PERMISSIONS on the server). */
const ADMIN_PERMISSIONS = new Set(['rbac.assign', 'identity.directory.read', 'system.configure', 'identity.local.manage', 'rbac.roles.manage', 'sources.configure', 'audit.read', 'backup.manage', 'nvr.configure', 'system.update']);

export function roleIsAdmin(role: RoleInfo | undefined): boolean {
  return !!role && role.permissions.some((p) => ADMIN_PERMISSIONS.has(p));
}

/** The roles a local identity may hold: everything but system_admin and roles with a system permission (owner answer Q3). */
export function localRoles(roles: RoleInfo[]): RoleInfo[] {
  return roles.filter((r) => r.id !== 'system_admin' && !r.system_role);
}

/** The full address of a link: the server gives it on the remote channel; under Ingress the public host is not known here. */
export function linkText(link: LinkShown): string {
  return link.url ?? `https://<כתובת הגישה מרחוק>${link.path}`;
}

/** A masked number (`····91`) inside Hebrew text keeps its left-to-right order (Unicode isolate). */
function ltr(text: string): string {
  return text ? `⁦${text}⁩` : '';
}

/**
 * USR2: Settings › משתמשים והרשאות › משתמשי Arx - people who exist only in Arx. A system administrator creates them (exactly one role
 * at one scope; never system_admin), hands over the first-login link (shown ONCE), resets, disables, deletes and ends their sessions.
 * Administrative targets (a role with an administrative permission) get links only from the local channel - on the remote channel
 * those actions are hidden and the server refuses them anyway. The page may name Home Assistant (a settings screen).
 */
@customElement('system-local-users')
export class SystemLocalUsers extends LitElement {
  @property({ attribute: false }) roles: RoleInfo[] = [];
  @property({ attribute: false }) scopes: ScopeRef[] = [];
  @state() private data: LocalUsersReply | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private creating = false;
  @state() private selected: string | null = null;
  @state() private link: LinkShown | null = null;
  @state() private copied = false;
  @state() private suggest = '';
  @state() private form = { username: '', display_name: '', role_id: 'viewer', scope: 'installation:*', email: '', notes: '', reset_mode: 'manager_only' };
  @state() private roleEdit: { role_id: string; scope: string } | null = null;
  @state() private sent: LinkSent | null = null;
  @state() private publicUrl = '';
  @state() private publicUrlNote = '';

  static styles = css`
    :host {
      display: block;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    .sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      max-inline-size: 70ch;
    }
    .note {
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      background: var(--sw-accent-soft);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .note.warn {
      background: var(--sw-warning-soft, var(--sw-accent-soft));
    }
    form,
    .panel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      padding: 14px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    input,
    select {
      font: inherit;
      min-block-size: 40px;
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      inline-size: 100%;
      box-sizing: border-box;
    }
    input.ltr {
      direction: ltr;
      text-align: start;
    }
    .actions {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .link {
      direction: ltr;
      text-align: start;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      word-break: break-all;
      user-select: all;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2, var(--sw-bg));
      border: 1px solid var(--sw-border);
    }
    .cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .full {
      grid-column: 1 / -1;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.data = await get<LocalUsersReply>('/identity/local-users');
      if (!this.publicUrl) this.publicUrl = this.data.public_url ?? '';
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async run(fn: () => Promise<void>) {
    this.busy = true;
    this.error = '';
    try {
      await fn();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private get remote(): boolean {
    return this.data?.channel === 'remote';
  }

  private roleOf(id: string | null): RoleInfo | undefined {
    return this.roles.find((r) => r.id === id);
  }

  private scopeParts(key: string): { scope_type: string; scope_id: string } {
    const i = key.indexOf(':');
    return { scope_type: key.slice(0, i), scope_id: key.slice(i + 1) };
  }

  private create(e: Event) {
    e.preventDefault();
    const f = this.form;
    void this.run(async () => {
      const r = await post<{ user: LocalUser; link: Omit<LinkShown, 'user'> }>('/identity/local-users', {
        username: f.username.trim(),
        display_name: f.display_name.trim(),
        role_id: f.role_id,
        ...this.scopeParts(f.scope),
        email: f.email.trim() || null,
        notes: f.notes.trim() || null,
        reset_mode: f.reset_mode,
      });
      this.link = { ...r.link, user: r.user.display_name };
      this.copied = false;
      this.creating = false;
      this.form = { ...this.form, username: '', display_name: '', email: '', notes: '' };
      await this.load();
    });
  }

  private issue(u: LocalUser, purpose: 'first_login' | 'reset', temporary = false) {
    void this.run(async () => {
      const r = await post<{ link: Omit<LinkShown, 'user'> }>(`/identity/local-users/${encodeURIComponent(u.id)}/link`, { purpose, via: 'shown', temporary });
      this.link = { ...r.link, user: u.display_name };
      this.sent = null;
      this.copied = false;
      await this.load();
    });
  }

  /** USR2 phase 2: the link goes to the user's verified WhatsApp number; the answer never carries it. */
  private issueWhatsapp(u: LocalUser, purpose: 'first_login' | 'reset') {
    void this.run(async () => {
      const r = await post<{ link: { expires_at: string } }>(`/identity/local-users/${encodeURIComponent(u.id)}/link`, { purpose, via: 'whatsapp' });
      this.link = null;
      this.sent = { user: u.display_name, to: u.whatsapp?.masked ?? '', expires_at: r.link.expires_at };
      await this.load();
    });
  }

  private savePublicUrl() {
    void this.run(async () => {
      await patch('/settings', { 'security.local_public_url': this.publicUrl.trim() });
      this.publicUrlNote = lit('publicUrlSaved');
      this.publicUrl = '';
      await this.load();
    });
  }

  private async copy() {
    if (!this.link) return;
    try {
      await navigator.clipboard.writeText(linkText(this.link));
      this.copied = true;
    } catch {
      this.copied = false;
    }
  }

  private setActive(u: LocalUser, active: boolean) {
    void this.run(async () => {
      const r = await patch<LocalUser & { suggest_also?: { ha_user_id: string } }>(`/identity/local-users/${encodeURIComponent(u.id)}`, { active });
      this.suggest = r.suggest_also ? lit('suggestAlso') : '';
      await this.load();
    });
  }

  private setResetMode(u: LocalUser, mode: string) {
    void this.run(async () => {
      await patch(`/identity/local-users/${encodeURIComponent(u.id)}`, { reset_mode: mode });
      await this.load();
    });
  }

  private removeUser(u: LocalUser) {
    if (!window.confirm(lit('removeConfirm', { name: u.display_name }))) return;
    void this.run(async () => {
      await del(`/identity/local-users/${encodeURIComponent(u.id)}`);
      this.selected = null;
      await this.load();
    });
  }

  private simple(u: LocalUser, what: 'unlock' | 'sessions/revoke') {
    void this.run(async () => {
      await post(`/identity/local-users/${encodeURIComponent(u.id)}/${what}`);
      await this.load();
    });
  }

  private saveRole(u: LocalUser) {
    const edit = this.roleEdit;
    if (!edit) return;
    void this.run(async () => {
      await put(`/identity/local-users/${encodeURIComponent(u.id)}/role`, { role_id: edit.role_id, ...this.scopeParts(edit.scope) });
      this.roleEdit = null;
      await this.load();
    });
  }

  private statusBadge(u: LocalUser): TemplateResult {
    const kind = u.status === 'active' ? 'live' : u.status === 'delayed' ? 'stale' : u.status === 'pending_first_login' ? 'neutral' : 'offline';
    return html`<sw-badge kind=${kind} label=${lit(`status_${u.status}` as LocalIdentityKey)}></sw-badge>`;
  }

  private renderCreate(): TemplateResult {
    const f = this.form;
    const roles = localRoles(this.roles);
    const admin = roleIsAdmin(this.roleOf(f.role_id));
    const up = (k: keyof typeof f) => (e: Event) => (this.form = { ...this.form, [k]: (e.target as HTMLInputElement).value });
    return html`<sw-card flush data-local-create>
      <form @submit=${this.create} novalidate>
        <label>${lit('colUsername')}<input class="ltr" .value=${f.username} @input=${up('username')} autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="32" required /></label>
        <label>${lit('displayName')}<input .value=${f.display_name} @input=${up('display_name')} maxlength="60" required /></label>
        <label>${lit('role')}<select .value=${f.role_id} @change=${up('role_id')} data-local-role>
          ${roles.map((r) => html`<option value=${r.id} ?selected=${r.id === f.role_id} ?disabled=${this.remote && roleIsAdmin(r)}>${r.name}</option>`)}
        </select></label>
        <label>${lit('scope')}<select .value=${f.scope} @change=${up('scope')}>
          ${this.scopes.map((s) => html`<option value=${`${s.type}:${s.id}`} ?selected=${`${s.type}:${s.id}` === f.scope}>${s.name}</option>`)}
        </select></label>
        <label>${lit('email')}<input class="ltr" type="email" .value=${f.email} @input=${up('email')} maxlength="254" /></label>
        <label>${lit('notes')}<input .value=${f.notes} @input=${up('notes')} maxlength="200" /></label>
        <label>${lit('resetMode')}<select .value=${admin ? 'manager_only' : f.reset_mode} @change=${up('reset_mode')} ?disabled=${admin} data-local-reset-mode>
          <option value="manager_only">${lit('reset_manager_only')}</option>
          <option value="self_service">${lit('reset_self_service')}</option>
        </select></label>
        ${admin ? html`<div class="note warn full" data-local-admin-note>${lit('adminNote')} ${lit('resetAdminNote')}</div>` : nothing}
        <div class="actions">
          <sw-button variant="primary" type="submit" ?disabled=${this.busy || (admin && this.remote)} data-local-create-save>${lit('create')}</sw-button>
          <sw-button variant="ghost" @click=${() => (this.creating = false)}>${lit('cancel')}</sw-button>
        </div>
      </form>
    </sw-card>`;
  }

  private renderLink(): TemplateResult | typeof nothing {
    const l = this.link;
    if (!l) return nothing;
    return html`<sw-card flush data-local-link>
      <div class="panel">
        <div class="full"><strong>${l.purpose === 'reset' ? lit('linkResetTitle') : lit('linkTitle')} · ${l.user}</strong></div>
        <div class="note full">${lit('linkOnce', { until: fmtWhen(l.expires_at) })}</div>
        <div class="link full" data-local-link-text>${linkText(l)}</div>
        <div class="actions">
          <sw-button variant="primary" icon="link" @click=${() => void this.copy()}>${this.copied ? lit('copied') : lit('copy')}</sw-button>
          <sw-button variant="ghost" @click=${() => (this.link = null)}>${lit('close')}</sw-button>
        </div>
      </div>
    </sw-card>`;
  }

  private renderSent(): TemplateResult | typeof nothing {
    const s = this.sent;
    if (!s) return nothing;
    return html`<div class="note" role="status" data-local-link-sent>${s.user} · ${lit('waSent', { to: ltr(s.to), until: fmtWhen(s.expires_at) })}
      <sw-button variant="ghost" @click=${() => (this.sent = null)}>${lit('close')}</sw-button></div>`;
  }

  /** The WhatsApp delivery actions of a NON-administrative target (hidden, with the reason, for an administrative one). */
  private renderWhatsapp(u: LocalUser): TemplateResult {
    const ready = this.data?.whatsapp_ready ?? false;
    const verified = !!u.whatsapp?.verified;
    const purpose: 'first_login' | 'reset' = u.status === 'pending_first_login' ? 'first_login' : 'reset';
    if (u.admin) return html`<div class="muted full" data-local-wa-admin>${lit('waAdminNote')}</div>`;
    return html`<div class="full cell" data-local-wa>
      <span class="muted" data-local-wa-state>${verified ? lit('waVerified', { masked: ltr(u.whatsapp?.masked ?? '') }) : lit('waNone')}</span>
      ${!ready ? html`<span class="muted" data-local-wa-off>${lit('waChannelOff')}</span>` : nothing}
      ${ready && verified
        ? html`<div class="actions"><sw-button @click=${() => this.issueWhatsapp(u, purpose)} ?disabled=${this.busy || !u.active} data-local-issue-wa=${purpose}>
            ${purpose === 'first_login' ? lit('issueFirstWa') : lit('issueResetWa')}</sw-button></div>`
        : nothing}
    </div>`;
  }

  private renderSelected(u: LocalUser): TemplateResult {
    const manage = this.data?.can_manage ?? false;
    const adminLocked = u.admin && this.remote;
    const roles = localRoles(this.roles);
    const edit = this.roleEdit;
    return html`<sw-card flush data-local-user=${u.id}>
      <div class="panel">
        <div class="full cell">
          <strong>${u.display_name}</strong>
          <span class="muted"><bdi>${u.username}</bdi> · ${u.role_name ?? '—'} · ${u.scope_name ?? '—'} · ${lit('sessions')}: ${u.sessions}</span>
          ${u.admin ? html`<span class="muted">${lit('adminNote')}</span>` : nothing}
        </div>
        ${manage
          ? html`<div class="actions">
              ${adminLocked
                ? html`<span class="muted" data-local-only>${lit('localOnly')}</span>`
                : u.status === 'pending_first_login'
                ? html`<sw-button @click=${() => this.issue(u, 'first_login')} ?disabled=${this.busy || !u.active} data-local-issue="first_login">${lit('issueFirst')}</sw-button>`
                : html`<sw-button @click=${() => this.issue(u, 'reset')} ?disabled=${this.busy || !u.active} data-local-issue="reset">${lit('issueReset')}</sw-button>
                    <sw-button variant="ghost" @click=${() => this.issue(u, 'reset', true)} ?disabled=${this.busy || !u.active}>${lit('temporary')}</sw-button>`}
              ${u.status === 'delayed' ? html`<sw-button @click=${() => this.simple(u, 'unlock')} ?disabled=${this.busy}>${lit('unlock')}</sw-button>` : nothing}
              <sw-button @click=${() => this.simple(u, 'sessions/revoke')} ?disabled=${this.busy || !u.sessions}>${lit('endSessions')}</sw-button>
              <sw-button @click=${() => this.setActive(u, !u.active)} ?disabled=${this.busy}>${u.active ? lit('disable') : lit('enable')}</sw-button>
              <sw-button @click=${() => (this.roleEdit = { role_id: u.role_id ?? 'viewer', scope: `${u.scope_type ?? 'installation'}:${u.scope_id ?? '*'}` })} ?disabled=${this.busy}>${lit('changeRole')}</sw-button>
              <sw-button variant="danger" @click=${() => this.removeUser(u)} ?disabled=${this.busy}>${lit('remove')}</sw-button>
            </div>
            <label>${lit('resetMode')}<select .value=${u.reset_mode} ?disabled=${this.busy || u.admin} @change=${(e: Event) => this.setResetMode(u, (e.target as HTMLSelectElement).value)}>
              <option value="manager_only">${lit('reset_manager_only')}</option>
              <option value="self_service">${lit('reset_self_service')}</option>
            </select></label>
            ${u.admin
              ? html`<div class="muted full" data-local-reset-admin>${lit('resetAdminNote')}</div>`
              : u.self_service_blocked
              ? html`<div class="note warn full" data-local-reset-blocked=${u.self_service_blocked}>${lit(`blocked_${u.self_service_blocked}` as LocalIdentityKey)}</div>`
              : html`<div class="muted full">${lit('resetModeHelp')}</div>`}
            ${this.renderWhatsapp(u)}
            ${edit
              ? html`<label>${lit('role')}<select .value=${edit.role_id} @change=${(e: Event) => (this.roleEdit = { ...edit, role_id: (e.target as HTMLSelectElement).value })}>
                    ${roles.map((r) => html`<option value=${r.id} ?selected=${r.id === edit.role_id} ?disabled=${this.remote && roleIsAdmin(r)}>${r.name}</option>`)}
                  </select></label>
                  <label>${lit('scope')}<select .value=${edit.scope} @change=${(e: Event) => (this.roleEdit = { ...edit, scope: (e.target as HTMLSelectElement).value })}>
                    ${this.scopes.map((s) => html`<option value=${`${s.type}:${s.id}`} ?selected=${`${s.type}:${s.id}` === edit.scope}>${s.name}</option>`)}
                  </select></label>
                  <div class="actions"><sw-button variant="primary" @click=${() => this.saveRole(u)} ?disabled=${this.busy}>${lit('save')}</sw-button><sw-button variant="ghost" @click=${() => (this.roleEdit = null)}>${lit('cancel')}</sw-button></div>`
              : nothing}`
          : nothing}
      </div>
    </sw-card>`;
  }

  /** USR2 phase 2: where WhatsApp links point (a system administrator sets it; the server refuses anyone else). */
  private renderPublicUrl(d: LocalUsersReply): TemplateResult {
    return html`<sw-card flush data-local-public-url>
      <div class="panel">
        <label class="full">${lit('publicUrl')}
          <input class="ltr" type="url" inputmode="url" placeholder=${d.public_url ?? 'https://'} .value=${this.publicUrl}
            @input=${(e: Event) => (this.publicUrl = (e.target as HTMLInputElement).value)} maxlength="300" data-local-public-url-input /></label>
        <div class="muted full">${lit('publicUrlHint')}</div>
        ${this.publicUrlNote ? html`<div class="note full" role="status">${this.publicUrlNote}</div>` : nothing}
        <div class="actions"><sw-button @click=${() => this.savePublicUrl()} ?disabled=${this.busy} data-local-public-url-save>${lit('publicUrlSave')}</sw-button></div>
      </div>
    </sw-card>`;
  }

  render() {
    const d = this.data;
    if (!d) return html`<div class="stack">${this.error ? html`<div class="note err" role="alert">${this.error}</div>` : html`<div class="muted">…</div>`}</div>`;
    const row = (x: Record<string, unknown>) => x as unknown as LocalUser;
    const columns: TableColumn[] = [
      {
        key: 'name',
        label: lit('colName'),
        render: (x) => html`<span style=${CELL}><span>${row(x).display_name}</span><span style=${MUTED}><bdi>${row(x).username}</bdi></span></span>`,
      },
      {
        key: 'role',
        label: lit('colRole'),
        render: (x) => html`<span style=${CELL}><span>${row(x).role_name ?? '—'}</span><span style=${MUTED}>${row(x).scope_name ?? ''}</span>
          <span style=${BADGES}>${row(x).admin ? html`<sw-badge kind="partial" label=${lit('adminBadge')}></sw-badge>` : nothing}${row(x).ha_user_id ? html`<sw-badge kind="neutral" label=${lit('haBadge')}></sw-badge>` : nothing}</span></span>`,
      },
      { key: 'status', label: lit('colStatus'), render: (x) => this.statusBadge(row(x)) },
      { key: 'last', label: lit('colLast'), render: (x) => (row(x).last_sign_in_at ? fmtWhen(row(x).last_sign_in_at) : lit('never')) },
      { key: 'factor', label: lit('colFactor'), render: (x) => (row(x).second_factor ? lit('factorOn') : lit('factorOff')) },
    ];
    const sel = d.users.find((u) => u.id === this.selected) ?? null;
    return html`<div class="stack" data-local-users>
      <div class="bar">
        <div class="sub">${lit('tabSub')}</div>
        ${d.can_manage && d.enabled
          ? html`<div class="actions">
              <sw-button variant="primary" icon="plus" @click=${() => (this.creating = !this.creating)} data-local-add>${lit('add')}</sw-button>
              <sw-button variant="ghost" @click=${() => window.open(apiUrl('/identity/local-users/export'), '_blank', 'noopener')}>${lit('export')}</sw-button>
            </div>`
          : nothing}
      </div>
      ${!d.enabled ? html`<div class="note warn" data-local-off>${lit('off')}</div>` : nothing}
      ${this.error ? html`<div class="note err" role="alert" data-local-error>${this.error}</div>` : nothing}
      ${this.suggest ? html`<div class="note warn" role="status">${this.suggest}</div>` : nothing}
      ${this.renderLink()}
      ${this.renderSent()}
      ${this.creating && d.enabled ? this.renderCreate() : nothing}
      ${d.users.length
        ? html`<sw-table .columns=${columns} .rows=${d.users as unknown as Record<string, unknown>[]} rowKey="id" .selected=${this.selected}
            @row-select=${(e: CustomEvent<{ id: string }>) => {
              this.selected = e.detail.id;
              this.roleEdit = null;
            }}></sw-table>`
        : html`<div class="muted" data-local-empty>${lit('empty')}</div>`}
      ${sel ? this.renderSelected(sel) : nothing}
      ${d.can_manage && d.enabled ? this.renderPublicUrl(d) : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-local-users': SystemLocalUsers;
  }
}
