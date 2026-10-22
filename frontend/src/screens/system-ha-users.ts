import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import '../components/sw-toggle';
import { ApiError, describeError } from '../api/client';
import { haUsersApi, type HaUsersView, type ManagedUser } from '../api/ha-users';
import { fmtWhen } from '../api/access';
import { settingsStyles } from '../styles/settings';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { ht, type HaUsersTextKey } from '../i18n/ha-users';
import { accessKey, canCreate, confirmMatches, draftProblems, emptyDraft, newRequestKey, repairKey, rowActions, stateKey, type Draft } from './ha-users-logic';

/**
 * USR1 (docs/design/USR1_HA_USERS_FROM_ARX.md): Settings › משתמשים והרשאות › משתמשי מערכת הבית (tab `ha-users` of system-access).
 *   הרשאה במערכת הבית  the last permission check (read-only probe) with "בדיקת הרשאה"; the not-authorised state says plainly what the
 *                      owner does (an administrator token saved in הגדרות › חיבורים › סודות - USR1-263).
 *   משתמשים שנוצרו דרך Arx  the managed users: name, username, Arx role and scope, state; "השבתה" / "הפעלה" (the safer action) and
 *                      "מחיקה" with the username typed. Users not created here are never listed (they live on the "משתמשים" tab).
 *   משתמש חדש          name, username, password twice, Arx role and scope, person card. The password lives only in the open dialog and is
 *                      cleared when it closes or the call returns.
 * Shown only with users.ha_manage (the tab is hidden otherwise); writes also need a home-system administrator (`actor_ha_admin`).
 */
@customElement('sw-ha-users')
export class SwHaUsers extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private view: HaUsersView | null = null;
  @state() private loadState: 'loading' | 'ready' | 'forbidden' | 'error' = 'loading';
  @state() private error = '';
  @state() private ok = '';
  @state() private busy = false;
  @state() private checking = false;
  @state() private createOpen = false;
  @state() private draft: Draft = emptyDraft();
  @state() private touched = false;
  @state() private formError = '';
  @state() private confirm: { user: ManagedUser; kind: 'deactivate' | 'activate' } | null = null;
  @state() private removing: ManagedUser | null = null;
  @state() private typed = '';
  private requestKey = '';

  static styles = [settingsStyles, bubbleChrome, css`
    .stack { display: flex; flex-direction: column; gap: var(--sw-s-3); max-inline-size: 960px; }
    .access { display: flex; align-items: flex-start; gap: var(--sw-s-3); flex-wrap: wrap; }
    .access .text { flex: 1; min-inline-size: 220px; display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .access .fix { color: var(--sw-text-2); font-size: var(--sw-fs-xs); line-height: 1.6; }
    .access .meta { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .tone-ok { color: var(--sw-success-text); }
    .tone-warn { color: var(--sw-warning-text); }
    .tone-err { color: var(--sw-danger-text); }
    .head { display: flex; align-items: center; gap: var(--sw-s-2); flex-wrap: wrap; margin-block-end: var(--sw-s-2); }
    .head h3 { margin: 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-text); }
    .head .grow { flex: 1; }
    .head .count { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .list { display: flex; flex-direction: column; }
    .item { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1.2fr) 6.5rem 13rem; gap: var(--sw-s-2) var(--sw-s-3); align-items: center;
      padding-block: 10px; border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .item:last-child { border-block-end: 0; }
    .item.hdr { color: var(--sw-text-3); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); padding-block: 4px; }
    .name { display: flex; flex-direction: column; min-inline-size: 0; }
    .name .sub { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap; }
    .chip.active { background: var(--sw-success-soft); color: var(--sw-success-text); }
    .chip.inactive { background: var(--sw-surface-3); color: var(--sw-text-2); }
    .chip.needs_repair { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .row-actions { display: flex; gap: var(--sw-s-1); flex-wrap: wrap; justify-content: flex-end; }
    .form { display: flex; flex-direction: column; gap: var(--sw-s-3); min-inline-size: min(440px, 100%); }
    .form label { display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .form .hint { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .in { box-sizing: border-box; min-block-size: 36px; padding-inline: 10px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm);
      background: var(--sw-surface-solid); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); inline-size: 100%; min-inline-size: 0; }
    .in[aria-invalid='true'] { border-color: var(--sw-danger); }
    .in:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 1px; }
    .ferr { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
    .form label.check { flex-direction: row; align-items: center; gap: var(--sw-s-2); }
    .body { font-size: var(--sw-fs-sm); color: var(--sw-text-2); line-height: 1.6; margin: 0; }
    @media (max-width: 720px) {
      .item { grid-template-columns: minmax(0, 1fr) auto; }
      .item.hdr { display: none; }
      .item .role, .item .user { grid-column: 1 / -1; }
      .row-actions { grid-column: 1 / -1; justify-content: flex-start; }
    }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.error = '';
    try {
      this.view = await haUsersApi.view();
      this.loadState = 'ready';
    } catch (err) {
      this.loadState = err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error';
      this.error = describeError(err);
    }
  }

  private flash(text: string): void {
    this.ok = text;
    this.error = '';
  }

  private async runCheck(): Promise<void> {
    if (!this.view) return;
    this.checking = true;
    try {
      const r = await haUsersApi.check();
      this.view = { ...this.view, access: r.access, transport: r.transport };
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.checking = false;
    }
  }

  private openCreate(): void {
    this.draft = emptyDraft(this.view?.roles.some((r) => r.id === 'viewer') ? 'viewer' : this.view?.roles[0]?.id ?? '');
    this.touched = false;
    this.formError = '';
    this.requestKey = newRequestKey();
    this.createOpen = true;
  }

  private closeCreate(): void {
    this.createOpen = false;
    this.draft = emptyDraft();  // the password never outlives the dialog
  }

  private async submitCreate(): Promise<void> {
    if (!this.view) return;
    this.touched = true;
    const problems = draftProblems(this.draft, this.view.password.min_length, this.view.password.max_length);
    if (Object.keys(problems).length) return;
    const [scopeType, ...rest] = this.draft.scope.split(':');
    this.busy = true;
    this.formError = '';
    try {
      const r = await haUsersApi.create({
        display_name: this.draft.display_name.trim(), username: this.draft.username, password: this.draft.password, role_id: this.draft.role_id,
        scope_type: scopeType, scope_id: rest.join(':') || '*', create_person: this.draft.create_person, request_key: this.requestKey,
      });
      this.closeCreate();
      this.flash(ht(r.user.repair === 'person_missing' ? 'createdNoPerson' : 'created', { name: r.user.display_name }));
      await this.load();
    } catch (err) {
      this.draft = { ...this.draft, password: '', password2: '' };
      this.formError = describeError(err);
      if (err instanceof ApiError && err.code !== 'password_weak' && err.code !== 'username_taken' && err.code !== 'validation') {
        this.requestKey = newRequestKey();
        await this.load();
      }
    } finally {
      this.busy = false;
    }
  }

  private async submitConfirm(): Promise<void> {
    const c = this.confirm;
    if (!c) return;
    this.busy = true;
    try {
      await haUsersApi.setActive(c.user.ha_user_id, c.kind === 'activate');
      this.confirm = null;
      this.flash(ht(c.kind === 'activate' ? 'activated' : 'deactivated'));
      await this.load();
    } catch (err) {
      this.confirm = null;
      this.error = describeError(err);
      await this.load();
    } finally {
      this.busy = false;
    }
  }

  private async submitRemove(): Promise<void> {
    const u = this.removing;
    if (!u || !confirmMatches(this.typed, u.username)) return;
    this.busy = true;
    try {
      await haUsersApi.remove(u.ha_user_id, this.typed);
      this.removing = null;
      this.typed = '';
      this.flash(ht('removed'));
      await this.load();
    } catch (err) {
      this.removing = null;
      this.typed = '';
      this.error = describeError(err);
      await this.load();
    } finally {
      this.busy = false;
    }
  }

  private renderAccess(v: HaUsersView): TemplateResult {
    const s = v.access.state;
    const tone = s === 'ok' ? 'tone-ok' : s === 'unknown' ? '' : s === 'unavailable' ? 'tone-warn' : 'tone-err';
    const icon = s === 'ok' ? 'check' : s === 'unknown' ? 'info' : 'warning';
    return html`<sw-card data-ha-access=${s}>
      <div class="head"><h3>${ht('accessTitle')}</h3></div>
      <div class="access">
        <sw-icon class=${tone} name=${icon} size=${18}></sw-icon>
        <div class="text">
          <span class=${tone} data-access-text>${ht(accessKey(s))}</span>
          ${s === 'not_authorised' ? html`<span class="fix" data-access-fix>${ht('acc_not_authorised_fix')}</span>` : nothing}
          ${v.access.checked_at ? html`<span class="meta">${ht('checkedAt', { time: fmtWhen(v.access.checked_at) })} · ${ht(v.transport === 'token' ? 'via_token' : 'via_supervisor')}</span>` : nothing}
        </div>
        <sw-button size="sm" icon="refresh" data-ha-check ?disabled=${this.checking || v.transport === 'none'} @click=${() => void this.runCheck()}>${this.checking ? ht('checking') : ht('check')}</sw-button>
      </div>
      ${v.actor_ha_admin ? nothing : html`<div class="msg warn" style="margin-block-start:var(--sw-s-2)" data-not-ha-admin><sw-icon name="lock" size=${13}></sw-icon>${ht('notHaAdmin')}</div>`}
    </sw-card>`;
  }

  private renderRow(u: ManagedUser, v: HaUsersView): TemplateResult {
    const a = rowActions(u, v, v.access.state);
    const repair = repairKey(u);
    return html`<div class="item" data-ha-user=${u.username}>
      <span class="name"><span>${bidi(u.display_name)}${u.is_self ? html` <span class="chip">${ht('you')}</span>` : nothing}</span>
        ${repair ? html`<span class="sub">${ht(repair)}</span>` : nothing}</span>
      <span class="user ltr">${u.username}</span>
      <span class="role">${u.role_name} · ${u.scope_name}</span>
      <span class=${`chip ${u.state}`} data-state=${u.state}>${ht(stateKey(u))}</span>
      <span class="row-actions">
        ${a.deactivate ? html`<sw-button size="sm" variant="secondary" data-deactivate @click=${() => (this.confirm = { user: u, kind: 'deactivate' })}>${ht('deactivate')}</sw-button>` : nothing}
        ${a.activate ? html`<sw-button size="sm" variant="secondary" data-activate @click=${() => (this.confirm = { user: u, kind: 'activate' })}>${ht('activate')}</sw-button>` : nothing}
        ${a.remove ? html`<sw-button size="sm" variant="ghost" icon="trash" data-remove @click=${() => { this.removing = u; this.typed = ''; }}>${ht('remove')}</sw-button>` : nothing}
      </span>
    </div>`;
  }

  private renderList(v: HaUsersView): TemplateResult {
    return html`<sw-card data-ha-list>
      <div class="head">
        <h3>${ht('listTitle')}</h3><span class="count">${ht('count', { n: v.users.length, max: v.limit })}</span><span class="grow"></span>
        ${canCreate(v) ? html`<sw-button variant="primary" size="sm" icon="plus" data-ha-add @click=${() => this.openCreate()}>${ht('add')}</sw-button>` : nothing}
      </div>
      ${v.users.length === 0
        ? html`<sw-state-panel icon="users" compact state="empty" heading=${ht('empty')} hint=${ht('emptyHint')}></sw-state-panel>`
        : html`<div class="list" role="list">
            <div class="item hdr" aria-hidden="true"><span>${ht('colName')}</span><span>${ht('colUser')}</span><span>${ht('colRole')}</span><span>${ht('colState')}</span><span></span></div>
            ${repeat(v.users, (u) => u.ha_user_id, (u) => this.renderRow(u, v))}
          </div>`}
    </sw-card>`;
  }

  private field(key: keyof Draft, value: string): void {
    this.draft = { ...this.draft, [key]: value };
  }

  private renderCreate(v: HaUsersView): TemplateResult {
    const p = this.touched ? draftProblems(this.draft, v.password.min_length, v.password.max_length) : {};
    const err = (k: keyof typeof p) => (p[k] ? html`<span class="ferr" role="alert">${ht(p[k] as HaUsersTextKey)}</span>` : nothing);
    return html`<sw-dialog heading=${ht('createTitle')} subheading=${ht('createSub')} .open=${this.createOpen} data-ha-create @close=${() => this.closeCreate()}>
      <form class="form" autocomplete="off" @submit=${(e: Event) => { e.preventDefault(); void this.submitCreate(); }}>
        <label>${ht('fName')}<input class="in" maxlength="60" data-f-name aria-invalid=${String(!!p.display_name)} .value=${this.draft.display_name}
          @input=${(e: Event) => this.field('display_name', (e.target as HTMLInputElement).value)} />${err('display_name')}</label>
        <label>${ht('fUsername')}<input class="in ltr" dir="ltr" maxlength="32" autocapitalize="off" spellcheck="false" data-f-username aria-invalid=${String(!!p.username)}
          .value=${this.draft.username} @input=${(e: Event) => this.field('username', (e.target as HTMLInputElement).value.trim().toLowerCase())} />
          <span class="hint">${ht('fUsernameHint')}</span>${err('username')}</label>
        <label>${ht('fPassword')}<input class="in ltr" dir="ltr" type="password" autocomplete="new-password" maxlength=${v.password.max_length} data-f-password
          aria-invalid=${String(!!p.password)} .value=${this.draft.password} @input=${(e: Event) => this.field('password', (e.target as HTMLInputElement).value)} />
          <span class="hint">${ht('fPasswordHint', { min: v.password.min_length })}</span>${err('password')}</label>
        <label>${ht('fPassword2')}<input class="in ltr" dir="ltr" type="password" autocomplete="new-password" maxlength=${v.password.max_length} data-f-password2
          aria-invalid=${String(!!p.password2)} .value=${this.draft.password2} @input=${(e: Event) => this.field('password2', (e.target as HTMLInputElement).value)} />${err('password2')}</label>
        <label>${ht('fRole')}<select class="in" data-f-role .value=${this.draft.role_id} @change=${(e: Event) => this.field('role_id', (e.target as HTMLSelectElement).value)}>
          ${v.roles.map((r) => html`<option value=${r.id} ?selected=${r.id === this.draft.role_id}>${r.name}</option>`)}</select>${err('role_id')}</label>
        ${v.scopes.length > 1 ? html`<label>${ht('fScope')}<select class="in" data-f-scope .value=${this.draft.scope} @change=${(e: Event) => this.field('scope', (e.target as HTMLSelectElement).value)}>
          ${v.scopes.map((s) => html`<option value=${`${s.type}:${s.id}`} ?selected=${`${s.type}:${s.id}` === this.draft.scope}>${s.name}</option>`)}</select></label>` : nothing}
        <label class="check"><sw-toggle data-f-person .checked=${this.draft.create_person} @change=${(e: Event) => (this.draft = { ...this.draft, create_person: (e.target as HTMLInputElement).checked })}></sw-toggle>${ht('fPerson')}</label>
        ${this.formError ? html`<span class="msg err" role="alert" data-form-error><sw-icon name="warning" size=${13}></sw-icon>${this.formError}</span>` : nothing}
      </form>
      <sw-button slot="footer" variant="ghost" @click=${() => this.closeCreate()}>${ht('cancel')}</sw-button>
      <sw-button slot="footer" variant="primary" data-f-submit ?disabled=${this.busy} @click=${() => void this.submitCreate()}>${ht('create')}</sw-button>
    </sw-dialog>`;
  }

  private renderConfirm(): TemplateResult {
    const c = this.confirm;
    const name = c?.user.display_name ?? '';
    return html`<sw-dialog heading=${c ? ht(c.kind === 'activate' ? 'activateTitle' : 'deactivateTitle', { name }) : ''} .open=${!!c} data-ha-confirm @close=${() => (this.confirm = null)}>
      <p class="body">${c ? ht(c.kind === 'activate' ? 'activateBody' : 'deactivateBody') : ''}</p>
      <sw-button slot="footer" variant="ghost" @click=${() => (this.confirm = null)}>${ht('cancel')}</sw-button>
      <sw-button slot="footer" variant="primary" data-confirm-go ?disabled=${this.busy} @click=${() => void this.submitConfirm()}>${ht('confirm')}</sw-button>
    </sw-dialog>`;
  }

  private renderRemove(): TemplateResult {
    const u = this.removing;
    return html`<sw-dialog heading=${u ? ht('removeTitle', { name: u.display_name }) : ''} .open=${!!u} data-ha-remove @close=${() => { this.removing = null; this.typed = ''; }}>
      <div class="form">
        <p class="body">${ht('removeBody')}</p>
        <label>${u ? ht('removeType', { username: u.username }) : ''}<input class="in ltr" dir="ltr" autocomplete="off" spellcheck="false" data-remove-typed .value=${this.typed}
          @input=${(e: Event) => (this.typed = (e.target as HTMLInputElement).value)} /></label>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${() => { this.removing = null; this.typed = ''; }}>${ht('cancel')}</sw-button>
      <sw-button slot="footer" variant="danger" data-remove-go ?disabled=${this.busy || !u || !confirmMatches(this.typed, u.username)} @click=${() => void this.submitRemove()}>${ht('removeConfirm')}</sw-button>
    </sw-dialog>`;
  }

  render() {
    if (this.loadState === 'loading') return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (this.loadState === 'forbidden') return html`<sw-state-panel state="forbidden" heading=${ht('forbidden')}></sw-state-panel>`;
    if (this.loadState === 'error' || !this.view) return html`<sw-state-panel state="error" heading=${this.error} actionLabel=${ht('retry')} @action=${() => void this.load()}></sw-state-panel>`;
    const v = this.view;
    return html`<div class="stack" data-ha-users>
      <p class="body">${ht('sub')}</p>
      ${this.ok || this.error ? html`<div>${this.ok ? html`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.ok}</span>` : nothing}${this.error ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}</div>` : nothing}
      ${this.renderAccess(v)}
      ${this.renderList(v)}
      ${this.renderCreate(v)}${this.renderConfirm()}${this.renderRemove()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-ha-users': SwHaUsers;
  }
}
