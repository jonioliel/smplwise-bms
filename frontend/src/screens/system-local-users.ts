import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { secondaryIdentity } from './user-identity'; // UXREST2-295: name and username shown once when equal
import { customElement, property, state } from 'lit/decorators.js';
import { toggled } from '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-badge';
import '../components/sw-card';
import '../components/sw-table';
import '../components/sw-state-panel';
import '../components/sw-dialog'; // CR-LOCAL-ID-SWITCH-2442: the confirmation of the feature switch
import './system-service-identity'; // USR2 P3: the service-identity card (local channel, system.configure)
import type { TableColumn } from '../components/sw-table';
import { ApiError, apiUrl, del, describeError, get, patch, post, put } from '../api/client';
import { fmtWhen, type RoleInfo, type ScopeRef } from '../api/access';
import { lit, type LocalIdentityKey } from '../i18n/local-identity';
import { adminRemovePasskey, adminRemovePasskeyCheck, adminSetPasskeyOnly, userPasskeys, type PasskeyView } from '../api/passkeys';
import type { FactorResetCheck } from '../api/second-factor';
import { refused, renderResetConfirm, resetConfirmStyles, resetErrorText, typedMatches } from '../components/factor-reset-confirm';
import { po } from '../i18n/passkey-only';
import { confirmDialog } from '../components/confirm-dialog';
import type * as LocalWire from '../api/generated/wire-local-identity';
import { tr } from '../i18n/msg/system-b';

/* USR2: an Arx-only identity and the tab's list are the backend's response models (smplwise_vms/backend/smplwise/wire/local_identity.py,
 * generated into ../api/generated/wire-local-identity.ts; code review 07:F8 step 2) - never a hash, never a link. */
type LocalUser = LocalWire.LocalUser;
type LocalUsersReply = LocalWire.LocalUserList;

/** CR-LOCAL-USER-CREATE-2438: a password the administrator types for a user (never kept after the request). */
interface PwDraft {
  password: string;
  again: string;
  must: boolean;
}

const PW_EMPTY: PwDraft = { password: '', again: '', must: true };

/** USR2 phase 2: a link that went by WhatsApp - nothing secret is shown, only where and until when. */
interface LinkSent {
  user: string;
  to: string;
  expires_at: string;
}

type LinkShown = { user: string } & LocalWire.LocalLink;

/** MFA-PASSKEY-ADMIN-REMOVE-2520: an armed passkey removal (which passkey, its preflight, the typed username, the box's error). */
interface PkArm {
  pk: string;
  check: FactorResetCheck | null | undefined;
  typed: string;
  error: string;
}

// sw-table renders the rows in its own shadow root: the cells carry their styles inline (this component's sheet never reaches them)
const CELL = 'display:flex;flex-direction:column;gap:2px;align-items:flex-start';
const MUTED = 'color:var(--sw-text-3);font-size:var(--sw-fs-xs)';
const BADGES = 'display:flex;flex-wrap:wrap;gap:4px';

/** The permissions that make a role administrative for a local identity (rbac.LOCAL_ADMIN_PERMISSIONS on the server). */
const ADMIN_PERMISSIONS = new Set(['rbac.assign', 'identity.directory.read', 'system.configure', 'identity.local.manage', 'rbac.roles.manage', 'sources.configure', 'audit.read', 'backup.manage', 'nvr.configure', 'system.update']);

function roleIsAdmin(role: RoleInfo | undefined): boolean {
  return !!role && role.permissions.some((p) => ADMIN_PERMISSIONS.has(p));
}

/** The roles a local identity may hold: everything but system_admin and roles with a system permission (owner answer Q3). */
export function localRoles(roles: RoleInfo[]): RoleInfo[] {
  return roles.filter((r) => r.id !== 'system_admin' && !r.system_role);
}

/** The full address of a link: the server gives it on the remote channel; under Ingress the public host is not known here. */
function linkText(link: LinkShown): string {
  return link.url ?? tr('https://<כתובת הגישה מרחוק>{path}', { path: link.path });
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
  /** CR-LOCAL-USER-CREATE-2438: how the new user gets a password ('set' = the administrator types it; 'link' = the first-login link),
   * the typed password, the create form's own error (shown INSIDE the form, next to the button) and the result line. */
  @state() private pwMode: 'set' | 'link' = 'set';
  @state() private pw: PwDraft = { ...PW_EMPTY };
  @state() private formError = '';
  @state() private done = '';
  /** The "set password" panel of the selected user (null = closed) and its own error. */
  @state() private pwEdit: PwDraft | null = null;
  @state() private pwError = '';
  @state() private sent: LinkSent | null = null;
  @state() private publicUrl = '';
  @state() private publicUrlNote = '';
  /** USR2 phase 4: the selected user's passkeys (loaded when the user is selected) and the administrator's own step-up code. */
  @state() private pk: { userId: string; items: PasskeyView[] } | null = null;
  @state() private pkStepUp = false;
  @state() private pkCode = '';
  /** MFA-PASSKEY-ADMIN-REMOVE-2520: the passkey whose removal is armed - the factor reset's dialog pattern (components/factor-reset-confirm):
   * its preflight (undefined while read, null when unreadable), the username the administrator typed, and the box's own error. */
  @state() private pkArm: PkArm | null = null;
  /** CR-LOCAL-ID-SWITCH-2442: the direction waiting for the administrator's confirmation, and the result line after it. */
  @state() private switching: 'on' | 'off' | null = null;
  @state() private switched = '';

  static styles = [resetConfirmStyles, css`
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
      color: var(--sw-danger-text);
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
    /* CR-CMP2-SEGMENTED-B-2450 (owner N10): every text field and select of the page sits in sw-field (the shared field look, one look
       for the whole form); the LTR fields keep their direction */
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
    /* ACCESS-POLISH-2331: a checkbox row (the passkey-first switch) - a checkbox is never a 100 % wide, 40 px tall field */
    label.check {
      flex-direction: row;
      align-items: center;
      gap: 10px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    label.check input {
      inline-size: 20px;
      min-block-size: 20px;
      block-size: 20px;
      flex: none;
      margin: 0;
    }
    label.check input:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    /* the selected user's and the create form's header: the title, and a close action at the far end */
    .head {
      grid-column: 1 / -1;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .head .cell {
      flex: 1;
      min-inline-size: 0;
    }
    .head strong {
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
    }
    /* a destructive action stands apart from the everyday ones */
    .actions .end {
      margin-inline-start: auto;
    }
    .sep {
      grid-column: 1 / -1;
      border-block-start: 1px solid var(--sw-border);
    }
    /* CR-LOCAL-USER-CREATE-2438: the set-password panel inside the selected user's card (the card's own grid, no second padding) */
    form.pwform {
      padding: 0;
    }
    label .muted {
      font-weight: var(--sw-fw-regular, 400);
    }
    /* CR-LOCAL-ID-SWITCH-2442: the switch button under the off-state text */
    .note .actions {
      margin-block-start: 10px;
    }
    /* MFA-PASSKEY-ADMIN-REMOVE-2520: the removal's confirmation under the passkey (the factor reset's pattern, this page's tokens) */
    .pk-reset {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      align-items: flex-start;
      padding-block: var(--sw-s-2);
    }
    .pk-reset .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .pk-reset .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .pk-reset form.typed-form {
      padding: 0;
    }
    .pk-reset input.typed {
      min-block-size: var(--sw-ctl-h-md);
      padding: var(--sw-s-1) var(--sw-s-2);
      border: thin solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font-family: inherit;
    }
    .pk-reset input.typed:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
  `];

  @state() private narrow = false;
  private narrowMq: MediaQueryList | null = null;
  private onNarrow = () => (this.narrow = !!this.narrowMq?.matches);

  connectedCallback(): void {
    super.connectedCallback();
    this.narrowMq = window.matchMedia('(max-width: 767px)');
    this.narrowMq.addEventListener('change', this.onNarrow);
    this.onNarrow();
    void this.load();
  }

  disconnectedCallback(): void {
    this.narrowMq?.removeEventListener('change', this.onNarrow);
    super.disconnectedCallback();
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

  private closeCreate() {
    this.creating = false;
    this.formError = '';
    this.pw = { ...PW_EMPTY, must: this.pw.must }; // a typed password does not wait in a closed form
  }

  private get pwMin(): number {
    return this.data?.password_min ?? 12;
  }

  /** What is wrong with a typed password before it is sent (the server's policy - common, contextual, repeated - answers the rest). */
  private pwProblem(d: PwDraft): string {
    if (!d.password || !d.again) return lit('pwMissing');
    if (d.password !== d.again) return lit('mismatch');
    if ([...d.password].length < this.pwMin) return lit('pwTooShort', { min: this.pwMin });
    return '';
  }

  /** CR-LOCAL-USER-CREATE-2438: the create form. A refusal - the page's own check or the server's - is shown inside the form with the
   * server's sentence; the form stays open with what was typed (the passwords too, so a policy refusal is fixed in place). */
  private async create(e: Event) {
    e.preventDefault();
    if (this.busy) return;
    const f = this.form;
    if (this.remote && roleIsAdmin(this.roleOf(f.role_id))) return; // the button is disabled; Enter must not send it either
    const withPw = this.pwMode === 'set';
    const pw = this.pw;
    this.formError = !f.username.trim() || !f.display_name.trim() ? lit('fillUsernameName') : withPw ? this.pwProblem(pw) : '';
    if (this.formError) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await post<LocalWire.LocalUserCreated>('/identity/local-users', {
        username: f.username.trim(),
        display_name: f.display_name.trim(),
        role_id: f.role_id,
        ...this.scopeParts(f.scope),
        email: f.email.trim() || null,
        notes: f.notes.trim() || null,
        reset_mode: f.reset_mode,
        ...(withPw ? { password: pw.password, must_change: pw.must } : {}),
      });
      this.link = r.link ? { ...r.link, user: r.user.display_name } : null;
      this.done = r.link ? '' : lit(r.user.must_change_password ? 'createdWithPwChange' : 'createdWithPw', { name: r.user.display_name, username: r.user.username });
      this.copied = false;
      this.creating = false;
      this.form = { ...this.form, username: '', display_name: '', email: '', notes: '' };
      this.pw = { ...PW_EMPTY, must: pw.must };
      await this.load();
    } catch (err) {
      this.formError = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** The administrator sets the password of an existing user (PUT .../password): the user's sign-ins end, the old password dies. */
  private async savePassword(u: LocalUser, e?: Event) {
    e?.preventDefault();
    const d = this.pwEdit;
    if (!d || this.busy) return;
    this.pwError = this.pwProblem(d);
    if (this.pwError) return;
    this.busy = true;
    this.error = '';
    try {
      await put(`/identity/local-users/${encodeURIComponent(u.id)}/password`, { password: d.password, must_change: d.must });
      this.pwEdit = null;
      this.link = null;
      this.done = lit(d.must ? 'pwSetDoneChange' : 'pwSetDone', { name: u.display_name });
      await this.load();
    } catch (err) {
      this.pwError = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** The password pair + the "must change" choice, shared by the create form and the selected user's panel. */
  private renderPwFields(d: PwDraft, set: (next: PwDraft) => void, mark: string): TemplateResult {
    const text = (k: 'password' | 'again') => (e: Event) => set({ ...d, [k]: (e.target as HTMLInputElement).value });
    return html`<label>${lit('pwField')}<sw-field><input class="ltr" type="password" autocomplete="new-password" maxlength="128" .value=${d.password} @input=${text('password')} data-local-pw=${mark} /></sw-field>
        <span class="muted">${lit('pwHint', { min: this.pwMin })}</span></label>
      <label>${lit('pwAgain')}<sw-field><input class="ltr" type="password" autocomplete="new-password" maxlength="128" .value=${d.again} @input=${text('again')} data-local-pw-again=${mark} /></sw-field></label>
      <label class="full check"><sw-toggle size="sm" labelHidden in-label label=${lit(mark === 'user' ? 'pwMustChangeNext' : 'pwMustChange')} .checked=${d.must} @change=${(e: Event) => set({ ...d, must: toggled(e) })} data-local-pw-must=${mark}></sw-toggle>
        ${lit(mark === 'user' ? 'pwMustChangeNext' : 'pwMustChange')}</label>
      <div class="muted full">${lit('pwMustChangeHelp')}</div>`;
  }

  private issue(u: LocalUser, purpose: 'first_login' | 'reset', temporary = false) {
    void this.run(async () => {
      const r = await post<Omit<LocalWire.LocalUserLink, 'link'> & { link: LocalWire.LocalLink }>(`/identity/local-users/${encodeURIComponent(u.id)}/link`, { purpose, via: 'shown', temporary });
      this.link = { ...r.link, user: u.display_name };
      this.sent = null;
      this.copied = false;
      await this.load();
    });
  }

  /** USR2 phase 2: the link goes to the user's verified WhatsApp number; the answer never carries it. */
  private issueWhatsapp(u: LocalUser, purpose: 'first_login' | 'reset') {
    void this.run(async () => {
      const r = await post<Omit<LocalWire.LocalUserLink, 'link'> & { link: LocalWire.LocalLinkQueued }>(`/identity/local-users/${encodeURIComponent(u.id)}/link`, { purpose, via: 'whatsapp' });
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

  /** CR-LOCAL-ID-SWITCH-2442: the feature switch (PATCH /settings; a system administrator only - the server decides and audits).
   * Afterwards the tab reads its data again, so the create / export / address sections follow the new state. */
  private applySwitch() {
    const to = this.switching;
    if (!to) return;
    this.switched = '';
    void this.run(async () => {
      try {
        await patch('/settings', { 'security.local_identity': to });
      } finally {
        this.switching = null; // a refusal (403, offline) shows in the tab's error note, not behind the dialog
      }
      this.creating = false;
      this.selected = null;
      this.roleEdit = null;
      this.pwEdit = null;
      this.pw = { ...PW_EMPTY };
      this.done = '';
      this.link = null;
      this.sent = null;
      this.switched = lit(to === 'on' ? 'switchedOn' : 'switchedOff');
      await this.load();
    });
  }

  private renderSwitchDialog(): TemplateResult | typeof nothing {
    const to = this.switching;
    if (!to) return nothing;
    return html`<sw-dialog open heading=${lit(to === 'on' ? 'switchOn' : 'switchOff')} ?locked=${this.busy} data-local-switch-dialog=${to} @close=${() => (this.switching = null)}>
      <div class="sub" data-local-switch-body>${lit(to === 'on' ? 'switchOnBody' : 'switchOffBody')}</div>
      <sw-button slot="footer" variant="ghost" ?disabled=${this.busy} @click=${() => (this.switching = null)}>${lit('cancel')}</sw-button>
      <sw-button slot="footer" variant=${to === 'on' ? 'primary' : 'danger'} ?disabled=${this.busy} @click=${() => this.applySwitch()} data-local-switch-confirm>${lit(to === 'on' ? 'switchOn' : 'switchOff')}</sw-button>
    </sw-dialog>`;
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
      const r = await patch<LocalWire.LocalUserPatched>(`/identity/local-users/${encodeURIComponent(u.id)}`, { active });
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

  private async removeUser(u: LocalUser) {
    if (!(await confirmDialog({ body: lit('removeConfirm', { name: u.display_name }), danger: true }))) return;
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

  /** USR2 phase 4: the selected user's passkeys (never a credential id or a key - only names, dates, flags). */
  private async loadPasskeys(userId: string) {
    try {
      const r = await userPasskeys(userId);
      if (this.selected === userId) this.pk = { userId, items: r.credentials };
    } catch {
      this.pk = null;
    }
  }

  /** MFA-PASSKEY-ADMIN-REMOVE-2520: "remove" arms the box under the passkey and reads the removal's preflight (may it go ahead, the
   * username to type, whether the user enrols again); an administrator with the authenticator code also types their own code. */
  private async armPasskeyRemove(u: LocalUser, id: string) {
    this.pkArm = { pk: id, check: undefined, typed: '', error: '' };
    this.pkCode = '';
    let check: FactorResetCheck | null = null;
    try {
      check = await adminRemovePasskeyCheck(u.id, id);
    } catch {
      check = null; // an older server or a failed read: the typed field is still asked, the server decides
    }
    if (this.pkArm?.pk !== id || this.selected !== u.id) return;
    this.pkArm = { ...this.pkArm, check };
    if (check?.step_up.methods.includes('totp')) this.pkStepUp = true;
  }

  private pkReady(): boolean {
    const arm = this.pkArm;
    return !!arm && arm.check !== undefined && !refused(arm.check) && typedMatches(arm.check, arm.typed) && (!this.pkStepUp || /^\d{6}$/.test(this.pkCode));
  }

  private async removePasskey(u: LocalUser) {
    const arm = this.pkArm;
    if (!arm || !this.pkReady() || this.busy) return; // FE-SAFETY-FIX-2520: Enter in the typed field confirms only when valid, once
    this.busy = true;
    try {
      await adminRemovePasskey(u.id, arm.pk, arm.typed, this.pkStepUp ? this.pkCode.trim() : undefined);
      this.pkArm = null;
      this.pkCode = '';
      await this.load();
      await this.loadPasskeys(u.id);
    } catch (err) {
      // the administrator's own TOTP factor is on: the removal needs their current code (CR-011 M1)
      if (err instanceof ApiError && err.body.code === 'second_factor_step_up_required') this.pkStepUp = true;
      // MFA-FACTOR-HARDEN-2520 N-5: from outside, the administrator's own sign-in must be less than 5 minutes old
      const text = err instanceof ApiError && err.body.code === 'reauth_required' ? lit('passkeyReauth') : resetErrorText(err);
      if (this.pkArm?.pk === arm.pk) this.pkArm = { ...this.pkArm, error: text };
    } finally {
      this.busy = false;
    }
  }

  /** The armed removal's box: the reset's confirmation (refusal, what goes, the typed username), the own code, remove / cancel. */
  private renderPasskeyRemove(u: LocalUser, arm: PkArm): TemplateResult {
    const no = refused(arm.check);
    return html`<div class="pk-reset" data-local-passkey-remove-box>
      <div class="lbl">${lit('passkeyAdminRemoveConfirm')}</div>
      ${renderResetConfirm(arm.check, arm.typed, (v) => { if (this.pkArm) this.pkArm = { ...this.pkArm, typed: v, error: '' }; }, () => void this.removePasskey(u))}
      ${this.pkStepUp && !no && arm.check !== undefined
        ? html`<label>${lit('code')}<sw-field><input class="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="6" .value=${this.pkCode}
            @input=${(e: Event) => (this.pkCode = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6))} data-local-passkey-code /></sw-field></label>`
        : nothing}
      <div class="actions">
        ${no ? nothing : html`<sw-button size="sm" variant="danger" ?disabled=${this.busy || !this.pkReady()} @click=${() => void this.removePasskey(u)} data-local-passkey-remove-confirm>${lit('passkeyAdminRemove')}</sw-button>`}
        <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => { this.pkArm = null; this.pkCode = ''; }} data-local-passkey-remove-cancel>${lit('cancel')}</sw-button>
      </div>
      ${arm.error ? html`<div class="err" role="alert" data-local-passkey-remove-error>${arm.error}</div>` : nothing}
    </div>`;
  }

  private passkeyFirstOff(u: LocalUser) {
    void this.run(async () => {
      await patch(`/identity/local-users/${encodeURIComponent(u.id)}`, { passkey_first: false });
      await this.load();
    });
  }

  private async passkeyOnly(u: LocalUser, on: boolean) {
    if (!(await confirmDialog({ body: po(on ? 'onlyConfirmOn' : 'onlyConfirmOff'), danger: on }))) return;
    void this.run(async () => {
      await adminSetPasskeyOnly(u.id, on);
      await this.load();
    });
  }

  private setPasskeyFirstAllowed(on: boolean) {
    void this.run(async () => {
      await patch('/settings', { 'security.local_passkey_first': on ? 'on' : 'off' });
      await this.load();
    });
  }

  /** Which user's passkeys were last requested (a plain field: a failed load must not re-request on every render). */
  private pkRequested: string | null = null;

  private renderPasskeys(u: LocalUser, manage: boolean): TemplateResult {
    if (this.pkRequested !== u.id) {
      this.pkRequested = u.id;
      void Promise.resolve().then(() => {
        this.pkStepUp = false;
        this.pkArm = null;
        return this.loadPasskeys(u.id);
      });
    }
    const items = this.pk?.userId === u.id ? this.pk.items : [];
    return html`<div class="full cell" data-local-passkeys>
      <span class="muted">${lit('passkeysCount', { n: u.passkeys ?? items.length })}${u.passkey_first ? html` · ${lit('passkeyFirstOn')}` : nothing}${u.passkey_only ? html` · ${po('onlyOn')}` : nothing}</span>
      ${items.map((p) => html`<span class="muted" data-local-passkey=${p.id}>${p.label || lit('passkeys')} · ${fmtWhen(p.created_at)}${p.synced ? html` · ${lit('passkeySynced')}` : nothing}${p.usable ? nothing : html` · ${lit('passkeyNotUsable')}`}
        ${manage && this.pkArm?.pk !== p.id ? html`<sw-button size="sm" variant="ghost" @click=${() => void this.armPasskeyRemove(u, p.id)} ?disabled=${this.busy} data-local-passkey-remove>${lit('passkeyAdminRemove')}</sw-button>` : nothing}</span>
        ${manage && this.pkArm && this.pkArm.pk === p.id ? this.renderPasskeyRemove(u, this.pkArm) : nothing}`)}
      ${manage && (u.passkey_only || (this.data?.passkey_first_allowed && (u.passkeys ?? items.length) > 0))
        ? html`<div class="actions"><sw-button @click=${() => this.passkeyOnly(u, !u.passkey_only)} ?disabled=${this.busy} data-local-passkey-only>${u.passkey_only ? po('onlyDisable') : po('onlyEnable')} · ${po('onlyLabel')}</sw-button></div>`
        : nothing}
      ${manage && u.passkey_first && !u.passkey_only
        ? html`<div class="actions"><sw-button @click=${() => this.passkeyFirstOff(u)} ?disabled=${this.busy} data-local-passkey-first-off>${lit('passkeyFirstAdminOff')}</sw-button></div>`
        : nothing}
    </div>`;
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
        <div class="head"><div class="cell"><strong>${lit('add')}</strong></div>
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${lit('cancel')} @click=${() => this.closeCreate()}></sw-button></div>
        <label>${lit('colUsername')}<sw-field><input class="ltr" .value=${f.username} @input=${up('username')} autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="32" required data-local-username /></sw-field>
          <span class="muted">${lit('usernameHint')}</span></label>
        <label>${lit('displayName')}<sw-field><input .value=${f.display_name} @input=${up('display_name')} maxlength="60" required data-local-display /></sw-field></label>
        <label>${lit('role')}<sw-field><select .value=${f.role_id} @change=${up('role_id')} data-local-role>
          ${roles.map((r) => html`<option value=${r.id} ?selected=${r.id === f.role_id} ?disabled=${this.remote && roleIsAdmin(r)}>${r.name}</option>`)}
        </select></sw-field></label>
        <label>${lit('scope')}<sw-field><select .value=${f.scope} @change=${up('scope')}>
          ${this.scopes.map((s) => html`<option value=${`${s.type}:${s.id}`} ?selected=${`${s.type}:${s.id}` === f.scope}>${s.name}</option>`)}
        </select></sw-field></label>
        <label>${lit('email')}<sw-field><input class="ltr" type="email" .value=${f.email} @input=${up('email')} maxlength="254" /></sw-field></label>
        <label>${lit('notes')}<sw-field><input .value=${f.notes} @input=${up('notes')} maxlength="200" /></sw-field></label>
        <label>${lit('resetMode')}<sw-field><select .value=${admin ? 'manager_only' : f.reset_mode} @change=${up('reset_mode')} ?disabled=${admin} data-local-reset-mode>
          <option value="manager_only">${lit('reset_manager_only')}</option>
          <option value="self_service">${lit('reset_self_service')}</option>
        </select></sw-field></label>
        ${admin ? html`<div class="note warn full" data-local-admin-note>${lit('adminNote')} ${lit('resetAdminNote')}</div>` : nothing}
        <div class="sep" role="presentation"></div>
        <label class="full">${lit('pwHow')}<sw-field><select .value=${this.pwMode} @change=${(e: Event) => { this.pwMode = (e.target as HTMLSelectElement).value === 'link' ? 'link' : 'set'; this.formError = ''; }} data-local-pw-mode>
          <option value="set" ?selected=${this.pwMode === 'set'}>${lit('pwHowSet')}</option>
          <option value="link" ?selected=${this.pwMode === 'link'}>${lit('pwHowLink')}</option>
        </select></sw-field></label>
        ${this.pwMode === 'set'
          ? this.renderPwFields(this.pw, (next) => (this.pw = next), 'create')
          : html`<div class="muted full" data-local-pw-link-help>${lit('pwLinkHelp')}</div>`}
        ${this.formError ? html`<div class="note err full" role="alert" data-local-create-error>${this.formError}</div>` : nothing}
        <div class="actions">
          <sw-button variant="primary" type="submit" ?disabled=${this.busy || (admin && this.remote)} data-local-create-save>${lit('create')}</sw-button>
          <sw-button variant="ghost" @click=${() => this.closeCreate()}>${lit('cancel')}</sw-button>
        </div>
        <!-- Enter in a field submits: the visible button sits in sw-button's shadow root, so the form needs a submit button of its own -->
        <button type="submit" hidden tabindex="-1" aria-hidden="true"></button>
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
        <div class="head">
          <div class="cell">
            <strong>${u.display_name}</strong>
            <span class="muted">${secondaryIdentity(u.display_name, u.username) ? html`<bdi>${u.username}</bdi> · ` : nothing}${u.role_name ?? '—'} · ${u.scope_name ?? '—'} · ${lit('sessions')}: ${u.sessions}</span>
            <span class="muted" data-local-user-meta>${lit('colLast')}: ${u.last_sign_in_at ? fmtWhen(u.last_sign_in_at) : lit('never')} · ${lit('colFactor')}: ${u.second_factor ? lit('factorOn') : lit('factorOff')}</span>
            ${u.admin ? html`<span class="muted">${lit('adminNote')}</span>` : nothing}
          </div>
          ${this.statusBadge(u)}
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${lit('close')} data-local-user-close @click=${() => { this.selected = null; this.roleEdit = null; this.pwEdit = null; }}></sw-button>
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
              ${adminLocked
                ? nothing
                : html`<sw-button @click=${() => { this.pwEdit = this.pwEdit ? null : { ...PW_EMPTY }; this.pwError = ''; }} ?disabled=${this.busy || !u.active} data-local-pw-set>${lit('pwSet')}</sw-button>`}
              <sw-button @click=${() => this.simple(u, 'sessions/revoke')} ?disabled=${this.busy || !u.sessions}>${lit('endSessions')}</sw-button>
              <sw-button @click=${() => this.setActive(u, !u.active)} ?disabled=${this.busy}>${u.active ? lit('disable') : lit('enable')}</sw-button>
              <sw-button @click=${() => (this.roleEdit = { role_id: u.role_id ?? 'viewer', scope: `${u.scope_type ?? 'installation'}:${u.scope_id ?? '*'}` })} ?disabled=${this.busy}>${lit('changeRole')}</sw-button>
              <sw-button class="end" variant="danger" @click=${() => this.removeUser(u)} ?disabled=${this.busy}>${lit('remove')}</sw-button>
            </div>
            ${this.pwEdit && !adminLocked
              ? html`<form class="full pwform" @submit=${(e: Event) => void this.savePassword(u, e)} novalidate data-local-pw-form>
                  <div class="full"><strong>${lit('pwSetTitle', { name: u.display_name })}</strong></div>
                  <div class="muted full">${lit('pwSetHelp')}</div>
                  ${this.renderPwFields(this.pwEdit, (next) => (this.pwEdit = next), 'user')}
                  ${this.pwError ? html`<div class="note err full" role="alert" data-local-pw-error>${this.pwError}</div>` : nothing}
                  <div class="actions">
                    <sw-button variant="primary" type="submit" ?disabled=${this.busy} data-local-pw-save>${lit('pwSet')}</sw-button>
                    <sw-button variant="ghost" @click=${() => (this.pwEdit = null)}>${lit('cancel')}</sw-button>
                  </div>
                  <button type="submit" hidden tabindex="-1" aria-hidden="true"></button>
                </form>`
              : nothing}
            <div class="sep" role="presentation"></div>
            <label>${lit('resetMode')}<sw-field><select .value=${u.reset_mode} ?disabled=${this.busy || u.admin} @change=${(e: Event) => this.setResetMode(u, (e.target as HTMLSelectElement).value)}>
              <option value="manager_only">${lit('reset_manager_only')}</option>
              <option value="self_service">${lit('reset_self_service')}</option>
            </select></sw-field></label>
            ${u.admin
              ? html`<div class="muted full" data-local-reset-admin>${lit('resetAdminNote')}</div>`
              : u.self_service_blocked
              ? html`<div class="note warn full" data-local-reset-blocked=${u.self_service_blocked}>${lit(`blocked_${u.self_service_blocked}` as LocalIdentityKey)}</div>`
              : html`<div class="muted full">${lit('resetModeHelp')}</div>`}
            ${this.renderWhatsapp(u)}
            ${this.renderPasskeys(u, manage)}
            ${edit
              ? html`<label>${lit('role')}<sw-field><select .value=${edit.role_id} @change=${(e: Event) => (this.roleEdit = { ...edit, role_id: (e.target as HTMLSelectElement).value })}>
                    ${roles.map((r) => html`<option value=${r.id} ?selected=${r.id === edit.role_id} ?disabled=${this.remote && roleIsAdmin(r)}>${r.name}</option>`)}
                  </select></sw-field></label>
                  <label>${lit('scope')}<sw-field><select .value=${edit.scope} @change=${(e: Event) => (this.roleEdit = { ...edit, scope: (e.target as HTMLSelectElement).value })}>
                    ${this.scopes.map((s) => html`<option value=${`${s.type}:${s.id}`} ?selected=${`${s.type}:${s.id}` === edit.scope}>${s.name}</option>`)}
                  </select></sw-field></label>
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
          <sw-field><input class="ltr" type="url" inputmode="url" placeholder=${d.public_url ?? 'https://'} .value=${this.publicUrl}
            @input=${(e: Event) => (this.publicUrl = (e.target as HTMLInputElement).value)} maxlength="300" data-local-public-url-input /></sw-field></label>
        <div class="muted full">${lit('publicUrlHint')}</div>
        ${this.publicUrlNote ? html`<div class="note full" role="status">${this.publicUrlNote}</div>` : nothing}
        <div class="actions"><sw-button @click=${() => this.savePublicUrl()} ?disabled=${this.busy} data-local-public-url-save>${lit('publicUrlSave')}</sw-button></div>
        <label class="full check"><sw-toggle size="sm" labelHidden in-label label=${lit('passkeySettingFirst')} .checked=${!!d.passkey_first_allowed} ?disabled=${this.busy}
            @change=${(e: Event) => this.setPasskeyFirstAllowed(toggled(e))} data-local-passkey-first-allowed></sw-toggle>
          ${lit('passkeySettingFirst')}</label>
        <div class="muted full">${lit('passkeySettingHelp')}</div>
      </div>
    </sw-card>`;
  }

  render() {
    const d = this.data;
    if (!d) {
      return html`<div class="stack">${this.error
        ? html`<sw-state-panel state="error" compact hint=${this.error} actionLabel=${tr('נסה שוב')} data-local-load-error @action=${() => void this.load()}></sw-state-panel>`
        : html`<sw-state-panel state="loading" compact data-local-loading></sw-state-panel>`}</div>`;
    }
    const row = (x: Record<string, unknown>) => x as unknown as LocalUser;
    const columns: TableColumn[] = [
      {
        key: 'name',
        label: lit('colName'),
        render: (x) => html`<span style=${CELL}><span>${row(x).display_name}</span>${secondaryIdentity(row(x).display_name, row(x).username) ? html`<span style=${MUTED}><bdi>${row(x).username}</bdi></span>` : nothing}</span>`,
      },
      {
        key: 'role',
        label: lit('colRole'),
        render: (x) => html`<span style=${CELL}><span>${row(x).role_name ?? '—'}</span><span style=${MUTED}>${row(x).scope_name ?? ''}</span>
          <span style=${BADGES}>${row(x).admin ? html`<sw-badge kind="partial" label=${lit('adminBadge')}></sw-badge>` : nothing}${row(x).ha_user_id ? html`<sw-badge kind="neutral" label=${lit('haBadge')}></sw-badge>` : nothing}</span></span>`,
      },
      { key: 'status', label: lit('colStatus'), render: (x) => this.statusBadge(row(x)) },
      { key: 'last', label: lit('colLast'), render: (x) => (row(x).last_sign_in_at ? fmtWhen(row(x).last_sign_in_at) : lit('never')) },
      {
        key: 'factor',
        label: lit('colFactor'),
        render: (x) => html`<span style=${CELL}><span>${row(x).second_factor ? lit('factorOn') : lit('factorOff')}</span>${row(x).passkeys
          ? html`<span style=${MUTED}>${lit('passkeysCount', { n: row(x).passkeys ?? 0 })}</span>`
          : nothing}</span>`,
      },
    ];
    // ACCESS-POLISH-2331: a phone stacks every row as a card - the last sign-in and the factor are in the selected user's panel
    const shown = this.narrow ? columns.filter((c) => c.key !== 'last' && c.key !== 'factor') : columns;
    const sel = d.users.find((u) => u.id === this.selected) ?? null;
    return html`<div class="stack" data-local-users>
      <div class="bar">
        <div class="sub">${lit('tabSub')}</div>
        ${d.can_manage && d.enabled
          ? html`<div class="actions">
              <sw-button variant="primary" icon="plus" @click=${() => { this.creating = !this.creating; this.formError = ''; this.done = ''; }} data-local-add>${lit('add')}</sw-button>
              <sw-button variant="ghost" @click=${() => window.open(apiUrl('/identity/local-users/export'), '_blank', 'noopener')}>${lit('export')}</sw-button>
            </div>`
          : nothing}
      </div>
      ${!d.enabled
        ? html`<div class="note warn" data-local-off>${lit('off')}${d.can_switch
            ? html`<div class="actions"><sw-button variant="primary" @click=${() => (this.switching = 'on')} ?disabled=${this.busy} data-local-switch="on">${lit('switchOn')}</sw-button></div>`
            : html` <span data-local-switch-readonly>${lit('offNotAdmin')}</span>`}</div>`
        : nothing}
      ${this.switched ? html`<div class="note" role="status" data-local-switched>${this.switched}</div>` : nothing}
      ${this.done ? html`<div class="note" role="status" data-local-done>${this.done}
          <sw-button variant="ghost" size="sm" @click=${() => (this.done = '')}>${lit('close')}</sw-button></div>` : nothing}
      ${d.can_manage ? html`<system-service-identity ?remote=${this.remote}></system-service-identity>` : nothing}
      ${this.error ? html`<div class="note err" role="alert" data-local-error>${this.error}</div>` : nothing}
      ${this.suggest ? html`<div class="note warn" role="status">${this.suggest}</div>` : nothing}
      ${this.renderLink()}
      ${this.renderSent()}
      ${this.creating && d.enabled ? this.renderCreate() : nothing}
      ${d.users.length
        ? html`<sw-table .columns=${shown} .rows=${d.users as unknown as Record<string, unknown>[]} rowKey="id" .selected=${this.selected}
            @row-select=${(e: CustomEvent<{ id: string }>) => {
              this.selected = e.detail.id;
              this.roleEdit = null;
              this.pwEdit = null;
              this.pwError = '';
            }}></sw-table>`
        : html`<sw-state-panel icon="users" state="empty" compact hint=${lit('empty')} data-local-empty></sw-state-panel>`}
      ${sel ? this.renderSelected(sel) : nothing}
      ${d.can_manage && d.enabled ? this.renderPublicUrl(d) : nothing}
      ${d.enabled && d.can_switch
        ? html`<div class="bar" data-local-on>
            <div class="sub">${lit('onState')}</div>
            <sw-button variant="danger" @click=${() => (this.switching = 'off')} ?disabled=${this.busy} data-local-switch="off">${lit('switchOff')}</sw-button>
          </div>`
        : nothing}
      ${this.renderSwitchDialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-local-users': SystemLocalUsers;
  }
}
