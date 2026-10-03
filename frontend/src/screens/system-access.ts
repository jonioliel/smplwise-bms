import './system-alarm'; // CR-010: the user's alarm code policy in the user drawer
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
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
import '../components/sw-state-panel';
import '../components/sw-dialog';
import '../components/sw-chip';
import type { TableColumn } from '../components/sw-table';
import { demoGroups, demoRoles, demoUsers, demoAudit } from '../fixtures/catalog';
import { can, isApi, session } from '../api/session';
import '../components/sw-toggle';
import { describeError } from '../api/client';
import { TabsModeController } from '../shell/tabs-mode';
import { loadTree, type CatalogTree } from '../api/catalog';
import {
  ACTION_LABEL,
  SYNC_LABEL,
  createBinding,
  createGroup,
  deleteGroup,
  fmtWhen,
  listAudit,
  listGroups,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  previewRole,
  setDelegation,
  renameGroup,
  bindGroup,
  unbindGroup,
  groupImpact,
  type GroupImpact,
  type RoleImpact,
  type RoleInfo,
  listUsers,
  setRemoteAccess,
  previewAccess,
  revokeBinding,
  setGroupMembers,
  syncDirectory,
  type AccessBinding,
  type AccessGroup,
  type AuditRow,
  type DirectoryResponse,
  type DirectoryUser,
  type PreviewResponse,
  type RolesResponse,
} from '../api/access';
import { SkinController } from '../design/skin';
import '../electricity/permission-rows'; // CR-023: the electricity permission rows (roles tab)
import { ENERGY_PERMISSION_LABELS } from '../electricity/permission-rows';
import { bubbleChrome } from '../styles/bubble-chrome';

const TABS = [
  { id: 'users', label: 'משתמשים', count: demoUsers.length },
  { id: 'groups', label: 'קבוצות', count: demoGroups.length },
  { id: 'roles', label: 'תפקידים', count: demoRoles.length },
  { id: 'effective', label: 'הרשאות אפקטיביות' },
  { id: 'audit', label: 'אודיט הרשאות' },
];

/** T055 (§15): the permissions a camera-scoped binding actually carries - everything served per camera. The rest of a
 * role (HA entities, WisKey, map editing, ...) needs a floor / site / installation binding and does nothing here. */
const CAMERA_PERMISSIONS = new Set(['map.read', 'video.live', 'video.playback', 'video.export', 'events.read', 'events.ack', 'cases.manage']);

interface ScopeOption {
  type: 'installation' | 'site' | 'building' | 'floor' | 'camera';
  id: string;
  name: string;
}

interface Wizard {
  subjectKind: 'user' | 'group';
  subjectId: string;
  subjectName: string;
  roleId: string;
  scopeKey: string; // `${type}:${id}`
  /** T055: a deny binding blocks exactly the chosen role's permissions in this scope, overriding any allow
   * elsewhere in the chain (rbac.authorize / effective_permissions) - the backend always supported it, the
   * wizard just never offered it. */
  effect: 'allow' | 'deny';
}

/** SC24 — user roles & permissions (board 3 screen 20): identity from HA only; assignments live only inside SMPLWISE. */
@customElement('system-access')
export class SystemAccess extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  /** 0.1.157: the permissions sub-tabs (5) follow the tabs mode and the dropdown style of the settings group. */
  private tabsMode = new TabsModeController(this, 'settings');
  @state() private tab = 'users';
  @state() private selected: string | null = null;
  @state() private assigning = false;
  @state() private step = 0;
  // api
  @state() private directory: DirectoryResponse | null = null;
  @state() private roles: RolesResponse | null = null;
  @state() private groups: AccessGroup[] | null = null;
  @state() private tree: CatalogTree | null = null;
  @state() private audit: AuditRow[] | null = null;
  @state() private selectedGroup: string | null = null;
  @state() private wizard: Wizard | null = null;
  @state() private members: Set<string> | null = null;
  @state() private newGroup = '';
  @state() private preview: PreviewResponse | null = null;
  @state() private previewUser = '';
  @state() private previewScope = 'installation:*';
  @state() private busy = false;
  @state() private error = '';
  @state() private message = '';
  @state() private forbidden = false;
  @state() private roleEdit: { id: string | null; revision: number; name: string; description: string; permissions: string[]; sensitive: string[]; delegable: boolean; assignMe?: boolean } | null = null;
  @state() private roleImpact: RoleImpact | null = null;
  @state() private roleDelete: RoleInfo | null = null;
  // T082 groups: lifecycle rights, the rename draft and the impact dialog shown before every group change
  @state() private groupsMeta: { can_manage: boolean; delegated: boolean } = { can_manage: false, delegated: false };
  @state() private renameDraft: string | null = null;
  @state() private groupChange: { heading: string; impact: GroupImpact; confirmLabel: string; run: () => Promise<void> } | null = null;
  /** CR-008 P2: turning a user's remote flag off while they have active remote sign-ins - the impact, awaiting a yes. */
  @state() private remoteOff: { userId: string; count: number } | null = null;
  private roleImpactTimer = 0;

  static styles = [css`
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
    /* the group drawer holds a rename field, the bindings and the member list: a taller stage (T082) */
    .groups-stage {
      min-block-size: 620px;
      margin-block-start: 12px;
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
    .perms {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 10px;
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .chk.sens {
      color: var(--sw-warning, #b45309);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .impact {
      margin-block-start: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .err.banner {
      padding: 8px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-danger-soft);
      border: 1px solid var(--sw-danger);
    }
    .permsrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .permsel {
      display: flex;
      gap: 4px;
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
      min-inline-size: 0;
    }
    dd .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .remote-off {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-block-start: 6px;
      padding: 8px;
      border-radius: var(--sw-r-sm, 6px);
      background: var(--sw-danger-soft, #fef2f2);
      font-size: var(--sw-fs-xs);
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
    .bind {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .bind .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .members {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 260px;
      overflow: auto;
      font-size: var(--sw-fs-sm);
    }
    .members label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 2px;
    }
    .bar {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: #15803d;
    }
    .err {
      color: var(--sw-danger);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-wrap: wrap;
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) void this.load();
  }

  private async load() {
    this.error = '';
    try {
      // the catalogue tree only names scopes for older backends; a delegated administrator's scope picker comes from
      // the directory's assign_scopes, so a tree the caller may not read must not fail the whole screen
      const [dir, roles, groups, tree] = await Promise.all([listUsers(), listRoles(), listGroups(), loadTree().catch(() => null)]);
      this.directory = dir;
      this.roles = roles;
      this.groups = groups.groups;
      this.groupsMeta = { can_manage: !!groups.can_manage, delegated: !!groups.delegated };
      this.tree = tree;
      this.forbidden = false;
      if (!this.previewUser) this.previewUser = session.me?.user.id ?? '';
      // a site admin previews only inside their own scopes: start on the first one they hold
      const opts = this.scopeOptions;
      if (opts.length && !opts.some((s) => `${s.type}:${s.id}` === this.previewScope)) this.previewScope = `${opts[0].type}:${opts[0].id}`;
    } catch (err) {
      const msg = describeError(err);
      this.error = msg;
      this.forbidden = /403|הרשאה|forbidden/i.test(msg) && !this.directory;
    }
  }

  private async loadAudit() {
    try {
      const [a, b] = await Promise.all([listAudit({ prefix: 'rbac.', limit: 100 }), listAudit({ prefix: 'identity.', limit: 50 })]);
      this.audit = [...a.rows, ...b.rows].sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 150);
    } catch (err) {
      this.error = describeError(err);
      this.audit = [];
    }
  }

  private flash(msg: string) {
    this.message = msg;
    setTimeout(() => (this.message = ''), 3500);
  }

  // ---- helpers ----

  private get scopeOptions(): ScopeOption[] {
    // T082: the server lists exactly the scopes where this user may assign (a site admin: their own subtree only)
    const own = this.directory?.assign_scopes;
    if (own && own.length) return own;
    const out: ScopeOption[] = [{ type: 'installation', id: '*', name: 'כל ההתקנה' }];
    for (const s of this.tree?.sites ?? []) {
      out.push({ type: 'site', id: s.id, name: `אתר · ${s.name}` });
      for (const b of s.buildings ?? []) {
        out.push({ type: 'building', id: b.id, name: `${s.name} · ${b.name}` });
        for (const f of b.floors ?? []) out.push({ type: 'floor', id: f.id, name: `${s.name} · ${b.name} · ${f.name}` });
      }
    }
    return out;
  }

  private userName(id: string): string {
    return this.directory?.users.find((u) => u.id === id)?.name ?? id;
  }

  private label(p: string): string {
    return this.roles?.labels[p] ?? ENERGY_PERMISSION_LABELS[p] ?? p;
  }

  private startWizard(kind: 'user' | 'group', id: string, name: string) {
    const roles = this.roles?.roles ?? [];
    const roleId = roles.some((r) => r.id === 'viewer') ? 'viewer' : roles[0]?.id ?? 'viewer';
    const first = this.scopeOptions[0];
    this.wizard = { subjectKind: kind, subjectId: id, subjectName: name, roleId, scopeKey: first ? `${first.type}:${first.id}` : 'installation:*', effect: 'allow' };
  }

  /** T055: switch the wizard between a place (installation / site / building / floor) and a single camera. */
  private pickScopeKind(w: Wizard, camera: boolean) {
    const opts = this.scopeOptions.filter((s) => (s.type === 'camera') === camera);
    const first = opts[0];
    if (first) this.wizard = { ...w, scopeKey: `${first.type}:${first.id}` };
  }

  /** T082: every group change is previewed first - the server names each affected user and what they gain or lose. */
  private async previewGroupChange(g: AccessGroup, heading: string, confirmLabel: string, body: Parameters<typeof groupImpact>[1], run: (revision: number) => Promise<void>) {
    this.busy = true;
    this.error = '';
    try {
      const impact = await groupImpact(g.id, body);
      this.groupChange = {
        heading,
        impact,
        confirmLabel,
        run: async () => {
          await run(impact.revision);
        },
      };
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async confirmGroupChange() {
    const c = this.groupChange;
    if (!c) return;
    this.busy = true;
    this.error = '';
    try {
      await c.run();
      this.groupChange = null;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
      this.groupChange = null;
      await this.load();
    } finally {
      this.busy = false;
    }
  }

  private async saveWizard() {
    const w = this.wizard;
    if (!w) return;
    const [scopeType, scopeId] = w.scopeKey.split(':') as [string, string];
    if (w.subjectKind === 'group') {
      const g = this.groups?.find((x) => x.id === w.subjectId);
      if (!g) return;
      const role = this.roles?.roles.find((r) => r.id === w.roleId);
      const scope = this.scopeOptions.find((s) => `${s.type}:${s.id}` === w.scopeKey);
      await this.previewGroupChange(g, `${w.effect === 'deny' ? 'חסימה' : 'שיוך'} לקבוצה "${g.name}": ${role?.name ?? w.roleId} · ${scope?.name ?? scopeId}`, 'שמור שיוך', { op: 'bind', role_id: w.roleId, scope_type: scopeType, scope_id: scopeId, effect: w.effect }, async (revision) => {
        await bindGroup(g.id, { role_id: w.roleId, scope_type: scopeType, scope_id: scopeId, effect: w.effect, revision });
        this.wizard = null;
        this.flash(`שויך לקבוצה "${g.name}"`);
      });
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      const b = await createBinding({ subject_kind: w.subjectKind, subject_id: w.subjectId, role_id: w.roleId, scope_type: scopeType, scope_id: scopeId, effect: w.effect });
      this.flash(w.effect === 'deny' ? `נחסם: ${b.role_name} · ${b.scope_name} (רוויזיה ${b.revision})` : `שויך: ${b.role_name} · ${b.scope_name} (רוויזיה ${b.revision})`);
      this.wizard = null;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async revoke(b: AccessBinding) {
    if (b.subject_kind === 'group' && !b.via_group) {
      const g = this.groups?.find((x) => x.id === b.subject_id);
      if (g) {
        await this.previewGroupChange(g, `ביטול שיוך של הקבוצה "${g.name}": ${b.role_name} · ${b.scope_name}`, 'בטל שיוך', { op: 'unbind', binding_id: b.id }, async (revision) => {
          await unbindGroup(g.id, b.id, revision);
          this.flash(`בוטל: ${b.role_name} · ${b.scope_name}`);
        });
        return;
      }
    }
    this.busy = true;
    this.error = '';
    try {
      await revokeBinding(b.id);
      this.flash(`בוטל: ${b.role_name} · ${b.scope_name}`);
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async sync() {
    this.busy = true;
    this.error = '';
    try {
      const r = await syncDirectory();
      this.flash(r.requested ? 'הספרייה נדחפה מ־Home Assistant' : r.note ?? 'הספרייה מתעדכנת אוטומטית כל דקה');
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async addGroup() {
    const name = this.newGroup.trim();
    if (!name) return;
    this.busy = true;
    this.error = '';
    try {
      const g = await createGroup(name);
      this.newGroup = '';
      this.flash(`נוצרה קבוצה "${g.name}"`);
      await this.load();
      this.selectedGroup = g.id;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async saveMembers(g: AccessGroup) {
    if (!this.members) return;
    const ids = [...this.members];
    await this.previewGroupChange(g, `חברי הקבוצה "${g.name}"`, 'שמור חברים', { op: 'members', user_ids: ids }, async (revision) => {
      await setGroupMembers(g.id, ids, revision);
      this.members = null;
      this.flash('חברי הקבוצה עודכנו');
    });
  }

  private async saveRename(g: AccessGroup) {
    const name = (this.renameDraft ?? '').trim();
    if (!name || name === g.name) {
      this.renameDraft = null;
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      await renameGroup(g.id, name, g.revision);
      this.renameDraft = null;
      this.flash(`שם הקבוצה עודכן ל"${name}"`);
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async removeGroup(g: AccessGroup) {
    this.busy = true;
    this.error = '';
    try {
      await deleteGroup(g.id, g.revision);
      this.selectedGroup = null;
      this.flash(`הקבוצה "${g.name}" נמחקה`);
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async runPreview() {
    if (!this.previewUser) return;
    const [scope_type, scope_id] = this.previewScope.split(':') as [string, string];
    this.busy = true;
    this.error = '';
    try {
      this.preview = await previewAccess({ user_id: this.previewUser, scope_type, scope_id });
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  // ---- API rendering ----

  /** A delegated administrator revokes only allow-listed roles, never their own binding (the server checks it again). */
  private canRevoke(b: AccessBinding, canAssign: boolean): boolean {
    if (!canAssign || b.via_group) return false;
    const d = this.directory;
    if (d?.delegated) {
      if (!(d.assignable_roles ?? []).includes(b.role_id)) return false;
      if (b.subject_kind === 'user' && b.subject_id === session.me?.user.id) return false;
    }
    return true;
  }

  private renderBindingRow(b: AccessBinding, canAssign: boolean) {
    return html`<div class="bind" data-binding=${b.id}>
      <div><strong>${b.role_name}</strong> · ${b.scope_name}${b.effect === 'deny' ? html` <sw-badge kind="forbidden" label="חסימה"></sw-badge>` : nothing}<div class="sub">${b.via_group ? `דרך קבוצה "${b.via_group}" · ` : ''}מאז ${fmtWhen(b.created_at)}${b.expires_at ? ` · עד ${fmtWhen(b.expires_at)}` : ''} · רוויזיה ${b.permission_revision}</div></div>
      ${this.canRevoke(b, canAssign) ? html`<sw-button size="sm" variant="ghost" icon="trash" data-revoke ?disabled=${this.busy} @click=${() => this.revoke(b)}>ביטול</sw-button>` : nothing}
    </div>`;
  }

  private renderWizard() {
    const w = this.wizard;
    if (!w || !this.roles) return nothing;
    const role = this.roles.roles.find((r) => r.id === w.roleId);
    const scope = this.scopeOptions.find((s) => `${s.type}:${s.id}` === w.scopeKey);
    const systemRole = role?.system_role ?? false;
    const deny = w.effect === 'deny';
    // T055: a camera is its own kind of scope - the picker lists only the cameras the server says are in reach
    const assignRole = role?.permissions.includes('rbac.assign') ?? false;
    const placeOpts = this.scopeOptions.filter((s) => s.type !== 'camera');
    const cameraOpts = this.scopeOptions.filter((s) => s.type === 'camera');
    const onCamera = w.scopeKey.startsWith('camera:');
    return html`<div class="wiz">
      <sw-steps .steps=${['תפקיד', 'היקף', 'תצוגה מקדימה', 'שמירה']} .current=${2}></sw-steps>
      <div class="hint">שיוך ל${w.subjectKind === 'group' ? 'קבוצה' : 'משתמש'}: <strong>${w.subjectName}</strong></div>
      ${this.directory?.delegated
        ? nothing /* T082 security review: a deny binding is a system-administrator tool; the server refuses it too */
        : html`<sw-field label="סוג שיוך"><select data-wizard-effect @change=${(e: Event) => (this.wizard = { ...w, effect: (e.target as HTMLSelectElement).value as 'allow' | 'deny' })}>
            <option value="allow" ?selected=${!deny}>הרשאה — מוסיף את הרשאות התפקיד בהיקף</option>
            <option value="deny" ?selected=${deny}>חסימה — מסיר את הרשאות התפקיד בהיקף, גם אם שיוך אחר מרשה</option>
          </select></sw-field>`}
      <sw-field label="תפקיד"><select data-wizard-role @change=${(e: Event) => (this.wizard = { ...w, roleId: (e.target as HTMLSelectElement).value })}>${this.roles.roles.map((r) => html`<option value=${r.id} ?selected=${r.id === w.roleId}>${r.name}</option>`)}</select></sw-field>
      <sw-field label="סוג היקף"><select data-wizard-scope-kind @change=${(e: Event) => this.pickScopeKind(w, (e.target as HTMLSelectElement).value === 'camera')}>
        <option value="place" ?selected=${!onCamera}>התקנה / אתר / מבנה / קומה</option>
        <option value="camera" ?selected=${onCamera} ?disabled=${!cameraOpts.length || systemRole || assignRole}>מצלמה</option>
      </select></sw-field>
      ${onCamera
        ? html`<sw-field label="מצלמה"><select data-wizard-camera @change=${(e: Event) => (this.wizard = { ...w, scopeKey: (e.target as HTMLSelectElement).value })}>${cameraOpts.map((s) => html`<option value=${`${s.type}:${s.id}`} ?selected=${`${s.type}:${s.id}` === w.scopeKey}>${s.name.replace(/^מצלמה · /, '')}</option>`)}</select></sw-field>`
        : html`<sw-field label="היקף"><select data-wizard-scope @change=${(e: Event) => (this.wizard = { ...w, scopeKey: (e.target as HTMLSelectElement).value })}>${placeOpts.map((s) => html`<option value=${`${s.type}:${s.id}`} ?selected=${`${s.type}:${s.id}` === w.scopeKey} ?disabled=${systemRole && s.type !== 'installation'}>${s.name}</option>`)}</select></sw-field>`}
      ${onCamera ? html`<div class="hint" data-camera-scope-hint>היקף מצלמה: ההרשאות חלות על המצלמה הזו בלבד — שידור חי, הקלטות, אירועים וייצוא שלה. במפה תוצג תוכנית הקומה שלה עם המצלמה הזו בלבד, בלי ישויות Home Assistant ובלי מצלמות אחרות. חסימה ברמה רחבה יותר (קומה, אתר, התקנה) גוברת גם עליה.</div>` : nothing}
      ${this.directory?.delegated ? html`<div class="hint" data-delegated-hint>כמנהל אתר מוצגים רק התפקידים שמותר לך להאציל וההיקפים שבאחריותך. אינך משנה את השיוכים של עצמך ואינך יוצר חסימות.</div>` : nothing}
      ${w.subjectKind === 'group' ? html`<div class="hint">לפני השמירה תוצג ההשפעה על כל אחד מחברי הקבוצה.</div>` : nothing}
      ${role
        ? deny
          ? html`<div class="eff">
              <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">ייחסמו ב־${scope?.name ?? 'ההיקף'}</div>${role.permissions.map((p) => html`<div class="row"><span>${this.label(p)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}</div>
              <div class="hint" style="align-self:start">חסימה פועלת רק על ההרשאות שהתפקיד הזה מקנה, ורק בהיקף שנבחר. היא גוברת על כל שיוך "הרשאה" אחר לאותו משתמש באותה הרשאה ובאותו היקף (או היקף שמכיל אותו) — לא על שיוכים בהיקפים לא קשורים.</div>
            </div>`
          : onCamera
            ? html`<div class="eff" data-camera-effect>
                <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מותר ב־${scope?.name ?? 'המצלמה'}</div>${role.permissions.filter((p) => CAMERA_PERMISSIONS.has(p)).map((p) => html`<div class="row"><span>${this.label(p)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}</div>
                <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">ללא השפעה בהיקף מצלמה</div>${role.permissions.filter((p) => !CAMERA_PERMISSIONS.has(p)).map((p) => html`<div class="row"><span>${this.label(p)}</span><sw-icon name="close" size=${14} style="color:var(--sw-text-3)"></sw-icon></div>`)}<div class="row"><span>כל מצלמה אחרת</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
              </div>`
          : html`<div class="eff">
              <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מותר ב־${scope?.name ?? 'ההיקף'}</div>${role.permissions.map((p) => html`<div class="row"><span>${this.label(p)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}</div>
              <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">לא כלול / מחוץ להיקף</div>${role.sensitive_missing.map((p) => html`<div class="row"><span>${this.label(p)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}<div class="row"><span>כל היקף אחר</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
            </div>`
        : nothing}
      ${systemRole ? html`<div class="hint">תפקיד עם הרשאות מערכת מוקצה רק ברמת ההתקנה כולה.</div>` : nothing}
      <div class="hint">הרשאות בתוך Arx בלבד. שום דבר לא נכתב ל־Home Assistant. השינוי נרשם באודיט עם diff לפני/אחרי.</div>
    </div>`;
  }

  /** CR-008: the per-user remote-access flag (remote.policy = flag). Off ends the user's remote sessions at once - so
   * with active sessions the switch first shows the impact ("N כניסות פעילות ייסגרו") and waits for a confirmation
   * (CR-008 P2). */
  private requestRemote(u: DirectoryUser, enabled: boolean) {
    const active = u.remote_sessions ?? 0;
    if (!enabled && active > 0 && (this.directory?.remote_policy ?? 'flag') === 'flag' && !u.remote_admin_default) {
      this.remoteOff = { userId: u.id, count: active };
      return;
    }
    void this.toggleRemote(u.id, enabled);
  }

  private async toggleRemote(userId: string, enabled: boolean) {
    this.busy = true;
    this.error = '';
    this.remoteOff = null;
    try {
      const r = await setRemoteAccess(userId, enabled);
      this.message = enabled ? 'הגישה מרחוק הופעלה' : r.sessions_ended ? `הגישה מרחוק כובתה · ${r.sessions_ended} כניסות נסגרו` : 'הגישה מרחוק כובתה';
      await this.load();
    } catch (err) {
      this.error = describeError(err);
      await this.load();
    } finally {
      this.busy = false;
    }
  }

  /** CR-008 P2: "N כניסות פעילות · אחרונה <when>" - the user's remote sign-ins as the roles screen shows them. */
  private remoteStats(u: DirectoryUser) {
    const n = u.remote_sessions ?? 0;
    const active = n === 0 ? 'אין כניסות פעילות מרחוק' : n === 1 ? 'כניסה פעילה אחת' : `${n} כניסות פעילות`;
    return `${active} · ${u.remote_last_sign_in ? `כניסה אחרונה מרחוק ${fmtWhen(u.remote_last_sign_in)}` : 'טרם נכנס מרחוק'}`;
  }

  private renderUsersApi() {
    const dir = this.directory!;
    const canAssign = dir.can_assign;
    const remoteColumn: TableColumn[] = dir.delegated
      ? []
      : [{ key: 'remote_access', label: 'מרחוק', render: (r) => { const u = r as unknown as DirectoryUser; const n = u.remote_sessions ?? 0; return html`<span data-remote-col style="font-size:var(--sw-fs-xs)">${u.remote_access_basis === 'admin_default' ? 'ברירת מחדל (מנהל)' : u.remote_access ? 'מופעלת' : 'כבויה'}${n ? html` · <sw-badge kind="live" label=${n === 1 ? 'מחובר' : `${n} חיבורים`}></sw-badge>` : nothing}</span><div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${u.remote_last_sign_in ? `אחרונה ${fmtWhen(u.remote_last_sign_in)}` : 'טרם נכנס'}</div>`; } }];
    const columns: TableColumn[] = [
      { key: 'name', label: 'שם', render: (r) => html`<div style="display:flex;align-items:center;gap:10px"><sw-avatar name=${String(r.name)} size=${30}></sw-avatar><div><strong>${String(r.name)}</strong>${r.is_admin ? html` <sw-badge kind="neutral" label="מנהל HA · מידע בלבד"></sw-badge>` : nothing}${r.is_self ? html` <sw-badge kind="recorded" label="אני"></sw-badge>` : nothing}<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3);direction:ltr;text-align:start">${String(r.username || r.id)}</div></div></div>` },
      { key: 'bindings', label: 'תפקיד · היקף', render: (r) => { const bs = r.bindings as AccessBinding[]; return bs.length ? html`${bs.slice(0, 2).map((b) => html`<div style="font-size:var(--sw-fs-xs)"><strong>${b.role_name}</strong> · ${b.scope_name}${b.via_group ? ` (קבוצה)` : ''}</div>`)}${bs.length > 2 ? html`<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">+${bs.length - 2}</div>` : nothing}` : html`<span style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">ללא שיוך · אין גישה לתוכן</span>`; } },
      { key: 'groups', label: 'קבוצות', render: (r) => html`<span style="font-size:var(--sw-fs-xs)">${(r.groups as { name: string }[]).map((g) => g.name).join(', ') || '—'}</span>` },
      { key: 'active', label: 'מצב', render: (r) => html`<span style="display:inline-flex;align-items:center;gap:6px;font-size:var(--sw-fs-xs)"><i style="inline-size:7px;block-size:7px;border-radius:50%;background:${r.active ? 'var(--sw-live)' : 'var(--sw-offline)'}"></i>${r.active ? 'פעיל' : 'ללא גישה (HA)'}</span>` },
      { key: 'sync_status', label: 'סנכרון', render: (r) => html`<span style="font-size:var(--sw-fs-xs)">${SYNC_LABEL[r.sync_status as DirectoryUser['sync_status']]}</span><div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${r.last_seen_at ? `נראה ${fmtWhen(String(r.last_seen_at))}` : 'טרם נכנס'}</div>` },
      ...remoteColumn,
    ];
    const u = dir.users.find((x) => x.id === this.selected) ?? null;
    return html`
      <div class="stage">
        ${dir.users.length
          ? html`<sw-table .columns=${columns} .rows=${dir.users as unknown as Record<string, unknown>[]} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => { this.selected = e.detail.id; this.wizard = null; }}></sw-table>`
          : html`<sw-state-panel state="empty" heading="אין משתמשים עדיין" hint=${dir.directory.paired ? 'הספרייה תגיע מהגשר תוך דקה.' : 'צמד את גשר Arx ב־Home Assistant כדי לקבל את רשימת המשתמשים.'}></sw-state-panel>`}
        ${u
          ? html`<sw-drawer open heading=${u.name} subheading=${`Home Assistant · ${u.username || u.id} · ${u.active ? 'פעיל' : 'ללא גישה'}`} @close=${() => { this.selected = null; this.wizard = null; }}>
              ${this.wizard && this.wizard.subjectKind === 'user'
                ? this.renderWizard()
                : html`<dl>
                    <dt>מקור זהות</dt><dd>Home Assistant · <span class="ltr">${u.id}</span></dd>
                    <dt>סנכרון</dt><dd>${SYNC_LABEL[u.sync_status]}${u.synced_at ? ` · ${fmtWhen(u.synced_at)}` : ''}</dd>
                    <dt>ב־Arx</dt><dd>${u.first_seen_at ? `מאז ${fmtWhen(u.first_seen_at)} · לאחרונה ${fmtWhen(u.last_seen_at)}` : 'טרם נכנס לממשק'}</dd>
                    <dt>מנהל HA</dt><dd>${u.is_admin ? 'כן · מידע בלבד, לא תפקיד במערכת' : 'לא'}</dd>
                    <dt>קבוצות</dt><dd>${u.groups.map((g) => g.name).join(', ') || '—'}</dd>
                    ${dir.delegated ? nothing : html`<dt>גישה מרחוק</dt><dd data-remote-access>${can('system.configure')
                      ? html`<sw-toggle label="SmplWise Arx" .checked=${live(!!u.remote_access && this.remoteOff?.userId !== u.id)} ?disabled=${this.busy || u.remote_access_basis === 'admin_default'} data-remote-access-toggle @change=${(e: CustomEvent<{ checked: boolean }>) => this.requestRemote(u, e.detail.checked)}></sw-toggle>`
                      : u.remote_access_basis === 'admin_default' ? 'ברירת מחדל (מנהל)' : u.remote_access ? 'מופעלת' : 'כבויה'}
                      ${u.remote_access_basis === 'admin_default' ? html`<div class="sub" data-remote-admin-default>ברירת מחדל (מנהל) · משתנה בהגדרות › גישה מרחוק</div>` : nothing}
                      <div class="sub" data-remote-stats>${this.remoteStats(u)}</div>
                      ${this.remoteOff?.userId === u.id
                        ? html`<div class="remote-off" role="alert" data-remote-off-impact>
                            <span>${this.remoteOff.count === 1 ? 'כניסה פעילה אחת תיסגר עכשיו' : `${this.remoteOff.count} כניסות פעילות ייסגרו עכשיו`} (כולל חיבורי וידאו פתוחים).</span>
                            <sw-button size="sm" variant="danger" data-remote-off-confirm ?disabled=${this.busy} @click=${() => void this.toggleRemote(u.id, false)}>כבה וסגור</sw-button>
                            <sw-button size="sm" variant="ghost" @click=${() => (this.remoteOff = null)}>ביטול</sw-button>
                          </div>`
                        : nothing}</dd>`}
                    ${!dir.delegated && can('system.configure') ? html`<dt>אזעקה</dt><dd data-alarm-user-policy><system-alarm-user .userId=${u.id} ?canEdit=${!this.busy}></system-alarm-user></dd>` : nothing}
                  </dl>
                  <div style="margin-block-start:10px;font-weight:600;font-size:var(--sw-fs-xs)">שיוכים</div>
                  ${u.bindings.length ? u.bindings.map((b) => this.renderBindingRow(b, canAssign)) : html`<div class="hint">ללא שיוך: אין גישה לתוכן.</div>`}
                  <div class="hint" style="margin-block-start:8px">אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד במערכת אוטומטית.</div>`}
              <div slot="footer">
                ${this.wizard
                  ? html`<sw-button variant="primary" size="sm" icon="check" data-wizard-save ?disabled=${this.busy} @click=${() => this.saveWizard()}>שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${() => (this.wizard = null)}>ביטול</sw-button>`
                  : html`${canAssign && !(dir.delegated && u.is_self) ? html`<sw-button variant="primary" size="sm" icon="plus" data-assign @click=${() => this.startWizard('user', u.id, u.name)}>שיוך תפקיד</sw-button>` : nothing}
                    <sw-button variant="ghost" size="sm" icon="shield" @click=${() => { this.previewUser = u.id; this.tab = 'effective'; void this.runPreview(); }}>הרשאות אפקטיביות</sw-button>`}
              </div>
            </sw-drawer>`
          : nothing}
      </div>
    `;
  }

  private renderGroupsApi() {
    const groups = this.groups ?? [];
    const dir = this.directory!;
    const canAssign = dir.can_assign;
    const columns: TableColumn[] = [
      { key: 'name', label: 'קבוצה', render: (r) => html`<strong>${String(r.name)}</strong>` },
      { key: 'members', label: 'חברים', render: (r) => html`${(r.members as { name: string }[]).length}` },
      { key: 'bindings', label: 'שיוכים (תפקיד · היקף)', render: (r) => html`${(r.bindings as AccessBinding[]).map((b) => html`<div style="font-size:var(--sw-fs-xs)">${b.role_name} · ${b.scope_name}</div>`)}` },
    ];
    const g = groups.find((x) => x.id === this.selectedGroup) ?? null;
    const memberSet = this.members ?? new Set(g?.members.map((m) => m.id) ?? []);
    const canManage = this.groupsMeta.can_manage;
    const delegated = !!dir.delegated;
    const me = session.me?.user.id;
    const inUse = g ? g.members.length > 0 || g.bindings.length > 0 : false;
    // members the list below cannot show (a delegated admin sees active people only) stay checked and untouched
    const known = new Set(dir.users.map((u) => u.id));
    const hidden = g ? g.members.filter((m) => !known.has(m.id)) : [];
    return html`
      <sw-card heading="קבוצות" subheading=${delegated ? 'הקבוצות שכל השיוכים שלהן בתוך ההיקף שלך · חברות ושיוך תפקידים מרשימת ההאצלה' : 'קבוצה מקבלת תפקיד בהיקף, וכל חבריה יורשים אותו · ההרשאות האפקטיביות = השיוכים האישיים + שיוכי הקבוצות, בכל היקף בנפרד'} data-groups-card>
        ${canManage
          ? html`<div class="toolbar"><sw-field label="קבוצה חדשה"><input data-group-new .value=${this.newGroup} placeholder="למשל: עורכי קומה 2" @input=${(e: Event) => (this.newGroup = (e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.addGroup(); }} /></sw-field><sw-button size="sm" icon="plus" data-group-create ?disabled=${this.busy || !this.newGroup.trim()} @click=${() => this.addGroup()}>יצירה</sw-button></div>`
          : html`<div class="hint">${delegated ? 'יצירה, שינוי שם ומחיקה של קבוצות — מנהל המערכת בלבד. קבוצה שיש לה שיוך מחוץ להיקף שלך, או שאתה חבר בה, אינה מוצגת כאן.' : 'יצירה, שינוי שם ומחיקה של קבוצות דורשים ניהול תפקידים (מנהל מערכת).'}</div>`}
      </sw-card>
        <div class="stage groups-stage">
          ${groups.length
            ? html`<sw-table .columns=${columns} .rows=${groups as unknown as Record<string, unknown>[]} .selected=${this.selectedGroup} @row-select=${(e: CustomEvent<{ id: string }>) => { this.selectedGroup = e.detail.id; this.members = null; this.wizard = null; this.renameDraft = null; }}></sw-table>`
            : html`<sw-state-panel state="empty" heading="אין קבוצות" hint=${delegated ? 'אין קבוצה שכל השיוכים שלה בתוך ההיקף שלך.' : 'קבוצה מקבלת תפקיד בהיקף, וכל חבריה יורשים אותו. קבוצות Arx בלבד, לא קבוצות HA.'}></sw-state-panel>`}
          ${g
            ? html`<sw-drawer open heading=${g.name} subheading=${`${g.members.length} חברים · ${g.bindings.length} שיוכים · רוויזיה ${g.revision}`} data-group-drawer @close=${() => { this.selectedGroup = null; this.members = null; this.wizard = null; this.renameDraft = null; }}>
                ${this.wizard && this.wizard.subjectKind === 'group'
                  ? this.renderWizard()
                  : html`${canManage
                      ? html`<div class="toolbar" style="margin-block-end:8px"><sw-field label="שם הקבוצה"><input data-group-rename .value=${this.renameDraft ?? g.name} @input=${(e: Event) => (this.renameDraft = (e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.saveRename(g); }} /></sw-field><sw-button size="sm" data-group-rename-save ?disabled=${this.busy || this.renameDraft === null || !this.renameDraft.trim() || this.renameDraft.trim() === g.name} @click=${() => this.saveRename(g)}>שינוי שם</sw-button></div>`
                      : nothing}
                    <div style="font-weight:600;font-size:var(--sw-fs-xs);margin-block-end:4px">שיוכים של הקבוצה</div>
                    ${g.bindings.length ? g.bindings.map((b) => this.renderBindingRow(b, canAssign)) : html`<div class="hint">ללא שיוך: החברים אינם מקבלים דבר דרך הקבוצה.</div>`}
                    <div style="font-weight:600;font-size:var(--sw-fs-xs);margin-block:10px 4px">חברים</div>
                    <div class="members">${dir.users.map((u) => html`<label><input type="checkbox" data-member=${u.id} ?disabled=${!canAssign || (delegated && u.id === me)} .checked=${memberSet.has(u.id)} @change=${(e: Event) => { const next = new Set(memberSet); if ((e.target as HTMLInputElement).checked) next.add(u.id); else next.delete(u.id); this.members = next; }} /> ${u.name}<span class="hint">${u.active ? '' : ' · ללא גישה'}${delegated && u.id === me ? ' · לא ניתן לצרף את עצמך' : ''}</span></label>`)}${hidden.map((m) => html`<label><input type="checkbox" checked disabled /> ${m.name}<span class="hint"> · מחוץ לרשימה שלך</span></label>`)}</div>
                    <div class="hint" style="margin-block-start:8px">שינוי חברות ושיוך נבדקים מול כל השיוכים של הקבוצה, מוצגים לפני השמירה עם ההשפעה על כל משתמש, ונרשמים באודיט.</div>
                    ${canManage && inUse ? html`<div class="hint" data-group-in-use>מחיקה אפשרית רק לקבוצה ללא חברים וללא שיוכים — הסר אותם קודם.</div>` : nothing}`}
                <div slot="footer">
                  ${this.wizard
                    ? html`<sw-button variant="primary" size="sm" icon="check" data-wizard-save ?disabled=${this.busy} @click=${() => this.saveWizard()}>שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${() => (this.wizard = null)}>ביטול</sw-button>`
                    : html`${canAssign
                        ? html`<sw-button variant="primary" size="sm" icon="check" data-group-save-members ?disabled=${this.busy || !this.members} @click=${() => this.saveMembers(g)}>שמור חברים</sw-button>
                          <sw-button size="sm" icon="plus" data-group-bind ?disabled=${this.busy} @click=${() => this.startWizard('group', g.id, g.name)}>שיוך תפקיד</sw-button>`
                        : nothing}
                      ${canManage ? html`<sw-button variant="danger" size="sm" icon="trash" data-group-delete ?disabled=${this.busy || inUse} @click=${() => this.removeGroup(g)}>מחיקה</sw-button>` : nothing}`}
                </div>
              </sw-drawer>`
            : nothing}
        </div>
      ${this.renderGroupChange()}
    `;
  }

  private renderGroupChange() {
    const c = this.groupChange;
    if (!c) return nothing;
    const im = c.impact;
    const lbl = (p: string) => im.labels[p] ?? this.label(p);
    const changeLabel = { member: 'חבר', added: 'מצטרף', removed: 'יוצא' } as const;
    return html`<sw-dialog open heading="השפעת השינוי" subheading=${c.heading} data-group-impact @close=${() => (this.groupChange = null)}>
      <div class="impact">
        <strong>${im.users.length} משתמשים מושפעים</strong>${im.scopes.length ? html` · היקפים: ${im.scopes.map((s) => s.scope_name).join(', ')}` : html` · לקבוצה אין שיוך, ולכן השינוי אינו משנה הרשאות`}
      </div>
      ${im.users.length
        ? html`<div class="members" style="margin-block-start:8px">${im.users.map((u) => html`<div class="bind" data-impact-user=${u.id}>
            <div><strong>${u.name}</strong> <sw-badge kind=${u.change === 'removed' ? 'forbidden' : 'recorded'} label=${changeLabel[u.change]}></sw-badge>
              <div class="sub">${u.added.length ? html`<span class="ok">יתווספו: ${u.added.map(lbl).join(', ')}</span>` : 'ללא הרשאות חדשות'} · ${u.removed.length ? html`<span class="err">יוסרו: ${u.removed.map(lbl).join(', ')}</span>` : 'ללא הסרות'}</div></div>
          </div>`)}</div>`
        : html`<div class="hint" style="margin-block-start:8px">אין חברים בקבוצה: אף משתמש אינו מושפע כרגע. מי שיצורף בהמשך יירש את השיוך.</div>`}
      <div class="hint" style="margin-block-start:8px">הרשאות בתוך Arx בלבד. השינוי נרשם באודיט (מזהים בלבד) וחל מהבקשה הבאה של כל משתמש.</div>
      <sw-button slot="footer" variant="ghost" @click=${() => (this.groupChange = null)}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-group-impact-confirm ?disabled=${this.busy} @click=${() => this.confirmGroupChange()}>${c.confirmLabel}</sw-button>
    </sw-dialog>`;
  }

  private openRole(r?: RoleInfo) {
    this.roleImpact = null;
    const sens = new Set(this.roles?.sensitive ?? []);
    this.roleEdit = r
      ? { id: r.id, revision: r.revision ?? 1, name: r.name, description: r.description ?? '', permissions: r.permissions.filter((p) => !sens.has(p)), sensitive: r.permissions.filter((p) => sens.has(p)), delegable: !!r.delegable }
      : { id: null, revision: 0, name: '', description: '', permissions: ['map.read'], sensitive: [], delegable: false };
    this.scheduleImpact();
  }

  private toggleRolePerm(p: string, sensitive: boolean) {
    const e = this.roleEdit;
    if (!e) return;
    const key = sensitive ? 'sensitive' : 'permissions';
    const list = e[key].includes(p) ? e[key].filter((x) => x !== p) : [...e[key], p];
    this.roleEdit = { ...e, [key]: list };
    this.scheduleImpact();
  }

  private scheduleImpact() {
    window.clearTimeout(this.roleImpactTimer);
    this.roleImpactTimer = window.setTimeout(() => void this.loadImpact(), 300);
  }

  private async loadImpact() {
    const e = this.roleEdit;
    if (!e || (!e.permissions.length && !e.sensitive.length)) {
      this.roleImpact = null;
      return;
    }
    try {
      this.roleImpact = await previewRole({ role_id: e.id, permissions: e.permissions, sensitive: e.sensitive });
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async saveRole() {
    const e = this.roleEdit;
    if (!e || !e.name.trim()) return;
    this.busy = true;
    this.error = '';
    try {
      const body = { name: e.name.trim(), description: e.description, permissions: e.permissions, sensitive: e.sensitive, delegable: e.delegable && !e.sensitive.length && !e.permissions.includes('rbac.assign') };
      if (e.id) {
        await updateRole(e.id, { ...body, revision: e.revision });
        this.roleEdit = null;
        this.roleImpact = null;
        this.message = 'התפקיד עודכן; השינוי חל על כל המשויכים ברענון הבא';
        this.roles = await listRoles();
        return;
      }
      const created = await createRole(body);
      // owner round 4 (1.2): the role itself is saved from this point on, whatever happens next - close the
      // dialog and refresh the list right away, so a failure in the *separate* auto-assign call below (it used
      // to be inside the same try/catch) can never again read as "the role did not save".
      this.roleEdit = null;
      this.roleImpact = null;
      this.roles = await listRoles();
      const me = session.me?.user.id;
      if (e.assignMe !== false && me) {
        try {
          await createBinding({ subject_kind: 'user', subject_id: me, role_id: created.id, scope_type: 'installation', scope_id: '*' });
          this.message = `התפקיד "${created.name}" נוצר ושויך אליך (כל המתקן). ההרשאות החדשות ייכנסו לתוקף ברענון הבא של הדף.`;
        } catch (bindErr) {
          this.message = `התפקיד "${created.name}" נוצר, אך השיוך האוטומטי אליך נכשל (${describeError(bindErr)}). שייך אותו ידנית בלשונית "שיוכים".`;
        }
      } else {
        this.message = `התפקיד "${created.name}" נוצר. שייך אותו למשתמש או לקבוצה בלשונית "שיוכים".`;
      }
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private setAllRolePerms(kind: 'permissions' | 'sensitive', ids: string[], on: boolean) {
    const e = this.roleEdit;
    if (!e) return;
    this.roleEdit = { ...e, [kind]: on ? [...new Set([...e[kind], ...ids])] : e[kind].filter((p) => !ids.includes(p)) };
    this.scheduleImpact();
  }

  private async removeRole(r: RoleInfo) {
    this.busy = true;
    this.error = '';
    try {
      await deleteRole(r.id);
      this.roleDelete = null;
      this.roles = await listRoles();
    } catch (err) {
      this.error = describeError(err);
      this.roleDelete = null;
    } finally {
      this.busy = false;
    }
  }

  private async toggleDelegable(roleId: string) {
    const current = this.roles?.delegable_roles ?? [];
    const next = current.includes(roleId) ? current.filter((x) => x !== roleId) : [...current, roleId];
    this.busy = true;
    this.error = '';
    try {
      await setDelegation(next);
      this.roles = await listRoles();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderRoleDialog() {
    const e = this.roleEdit;
    const roles = this.roles;
    if (!e || !roles) return nothing;
    const sens = new Set(roles.sensitive);
    const sys = new Set(roles.system_permissions ?? []);
    const ordinary = Object.keys(roles.labels).filter((p) => !sens.has(p) && !sys.has(p));
    const im = this.roleImpact;
    return html`<sw-dialog open heading=${e.id ? 'עריכת תפקיד מותאם' : 'תפקיד מותאם חדש'} subheading="הרשאות רגילות + הרשאות רגישות במפורש · ללא הרשאות מערכת · ההשפעה מוצגת לפני השמירה" data-role-dialog @close=${() => (this.roleEdit = null)}>
      ${this.error ? html`<div class="err banner" data-role-error>${this.error}</div>` : nothing}
      <sw-field label="שם"><input data-role-name .value=${e.name} @input=${(ev: Event) => (this.roleEdit = { ...e, name: (ev.target as HTMLInputElement).value })} /></sw-field>
      <sw-field label="תיאור"><input .value=${e.description} @input=${(ev: Event) => (this.roleEdit = { ...e, description: (ev.target as HTMLInputElement).value })} /></sw-field>
      <div class="hint permsrow">הרשאות רגילות
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-perm-all @click=${() => this.setAllRolePerms('permissions', ordinary, true)}>בחר הכל</sw-button>
          <sw-button size="sm" variant="ghost" data-role-perm-none @click=${() => this.setAllRolePerms('permissions', ordinary, false)}>נקה הכל</sw-button>
        </span>
      </div>
      <div class="perms">${ordinary.map((p) => html`<label class="chk"><input type="checkbox" data-role-perm=${p} .checked=${e.permissions.includes(p)} @change=${() => this.toggleRolePerm(p, false)} /> ${roles.labels[p]}</label>`)}</div>
      <div class="hint permsrow" style="margin-block-start:6px">הרשאות רגישות — לעולם לא מרומזות, נדרשות במפורש
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-sensitive-all @click=${() => this.setAllRolePerms('sensitive', roles.sensitive, true)}>בחר הכל</sw-button>
          <sw-button size="sm" variant="ghost" data-role-sensitive-none @click=${() => this.setAllRolePerms('sensitive', roles.sensitive, false)}>נקה הכל</sw-button>
        </span>
      </div>
      <div class="perms">${roles.sensitive.map((p) => html`<label class="chk sens"><input type="checkbox" data-role-sensitive=${p} .checked=${e.sensitive.includes(p)} @change=${() => this.toggleRolePerm(p, true)} /> ${roles.labels[p] ?? p}</label>`)}</div>
      ${!e.id ? html`<label class="chk" style="margin-block-start:6px"><input type="checkbox" data-role-assign-me .checked=${e.assignMe !== false} @change=${(ev: Event) => (this.roleEdit = { ...e, assignMe: (ev.target as HTMLInputElement).checked })} /> שייך את התפקיד אליי מיד (כל המתקן)</label>` : nothing}
      <label class="chk" style="margin-block-start:6px"><input type="checkbox" data-role-delegable ?disabled=${e.sensitive.length > 0 || e.permissions.includes('rbac.assign')} .checked=${e.delegable && !e.sensitive.length && !e.permissions.includes('rbac.assign')} @change=${(ev: Event) => (this.roleEdit = { ...e, delegable: (ev.target as HTMLInputElement).checked })} /> מנהל אתר רשאי להקצות תפקיד זה בהיקפו (בכפוף להרשאות שהוא מחזיק)${e.sensitive.length || e.permissions.includes('rbac.assign') ? html`<span class="hint"> · לא זמין: תפקיד עם הרשאה רגישה או עם שיוך תפקידים אינו ניתן להאצלה</span>` : nothing}</label>
      ${im
        ? html`<div class="impact" data-role-impact>
            <strong>השפעת השינוי:</strong> ${im.bindings} שיוכים · ${im.users.length} משתמשים${im.users.length ? ` (${im.users.map((u) => u.name).join(', ')})` : ''}${im.groups.length ? ` · ${im.groups.length} קבוצות` : ''}${im.scopes.length ? ` · היקפים: ${im.scopes.join(', ')}` : ''}
            <div>${im.added.length ? html`יתווספו: ${im.added.map((p) => roles.labels[p] ?? p).join(', ')}` : 'ללא הרשאות חדשות'} · ${im.removed.length ? html`<span class="err">יוסרו: ${im.removed.map((p) => roles.labels[p] ?? p).join(', ')}</span>` : 'ללא הסרות'}</div>
          </div>`
        : nothing}
      <sw-button slot="footer" variant="ghost" @click=${() => (this.roleEdit = null)}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-role-save ?disabled=${this.busy || !e.name.trim() || (!e.permissions.length && !e.sensitive.length)} @click=${() => this.saveRole()}>${e.id ? 'שמירה' : 'צור תפקיד'}</sw-button>
    </sw-dialog>`;
  }

  private renderRolesApi() {
    const roles = this.roles!;
    return html`<div class="roles">${roles.roles.map((r) => html`<sw-card class="role" data-role-card=${r.id}><h4><span class="ic"><sw-icon name=${r.custom ? 'user' : r.id === 'viewer' ? 'eye' : r.id === 'operator' ? 'play' : r.id === 'editor' ? 'edit' : r.id === 'site_admin' ? 'building' : r.id === 'kiosk' ? 'grid' : 'shield'} size=${14}></sw-icon></span>${r.name}${r.custom ? html` <sw-badge kind="recorded" label="מותאם"></sw-badge>` : nothing}${r.system_role ? html` <sw-badge kind="neutral" label="הרשאות מערכת"></sw-badge>` : nothing}${r.delegable ? html` <sw-badge kind="historic" label="ניתן להאצלה"></sw-badge>` : nothing}</h4>${r.description ? html`<div class="d">${r.description}</div>` : nothing}<div class="a">מותר: ${r.permissions.map((p) => this.label(p)).join(', ')}</div><div class="d">לא כלול אוטומטית: ${r.sensitive_missing.map((p) => this.label(p)).join(', ') || '—'}</div>${r.custom && roles.can_manage_roles ? html`<div style="display:flex;gap:6px;margin-block-start:8px"><sw-button size="sm" data-role-edit @click=${() => this.openRole(r)}>עריכה</sw-button><sw-button size="sm" variant="ghost" icon="trash" data-role-delete @click=${() => (this.roleDelete = r)}>מחיקה</sw-button></div>` : nothing}</sw-card>`)}</div>
      ${roles.can_manage_roles
        ? html`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" data-role-new @click=${() => this.openRole()}>תפקיד מותאם חדש</sw-button></div>
            <sw-card heading="האצלת שיוך תפקידים למנהלי אתר" subheading="מנהל אתר משייך רק תפקידים מהרשימה הזו, רק הרשאות שהוא מחזיק בעצמו, רק בתוך ההיקף שלו, ולעולם לא לעצמו; קבוצה — רק כשכל השיוכים שלה בהיקף שלו" style="margin-block-start:12px" data-delegation>
              <div class="chips">${roles.roles.filter((r) => !r.delegation_block).map((r) => html`<sw-chip data-delegable=${r.id} ?selected=${(roles.delegable_roles ?? []).includes(r.id)} @click=${() => void this.toggleDelegable(r.id)}>${r.name}</sw-chip>`)}</div>
              <div class="hint" style="margin-block-start:6px" data-delegation-blocked>לעולם לא ניתנים להאצלה: ${roles.roles.filter((r) => r.delegation_block).map((r) => `${r.name} (${r.delegation_block === 'system_role' ? 'תפקיד ניהול / הרשאות מערכת' : r.delegation_block === 'assign_role' ? 'כולל שיוך תפקידים' : 'הרשאה רגישה'})`).join(' · ') || '—'}. ברירת המחדל: צופה ומפעיל.</div>
            </sw-card>`
        : roles.delegated
          ? html`<div class="hint" style="margin-block-start:10px" data-delegation>מוצגים רק התפקידים שמותר לך לשייך בהיקף שלך (רשימת ההאצלה של ההתקנה). עריכת תפקידים והרשימה — מנהל המערכת בלבד.</div>`
          : nothing}
      <div class="hint">תפקידים מובנים אינם נערכים; תפקיד מותאם מורכב מהרשאות רגילות ומהרשאות רגישות שניתנות במפורש, ולעולם לא מהרשאות מערכת. התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.</div>
      <elec-permission-rows .roles=${roles}></elec-permission-rows>
      ${this.renderRoleDialog()}
      ${this.roleDelete
        ? html`<sw-dialog open heading="מחיקת תפקיד" subheading=${this.roleDelete.name} @close=${() => (this.roleDelete = null)}>
            <div class="hint">תפקיד משויך אינו נמחק: בטל קודם את השיוכים. המחיקה נרשמת באודיט.</div>
            <sw-button slot="footer" variant="ghost" @click=${() => (this.roleDelete = null)}>ביטול</sw-button>
            <sw-button slot="footer" variant="danger" icon="trash" data-role-delete-confirm ?disabled=${this.busy} @click=${() => void this.removeRole(this.roleDelete!)}>מחק</sw-button>
          </sw-dialog>`
        : nothing}`;
  }

  private renderEffectiveApi() {
    const dir = this.directory!;
    const p = this.preview;
    return html`
      <div class="toolbar">
        <sw-field label="משתמש"><select @change=${(e: Event) => (this.previewUser = (e.target as HTMLSelectElement).value)}>${dir.users.map((u) => html`<option value=${u.id} ?selected=${u.id === this.previewUser}>${u.name}</option>`)}</select></sw-field>
        <sw-field label="היקף"><select @change=${(e: Event) => (this.previewScope = (e.target as HTMLSelectElement).value)}>${this.scopeOptions.map((s) => html`<option value=${`${s.type}:${s.id}`} ?selected=${`${s.type}:${s.id}` === this.previewScope}>${s.name}</option>`)}</select></sw-field>
        <sw-button size="sm" icon="shield" ?disabled=${this.busy || !this.previewUser} @click=${() => this.runPreview()}>חשב</sw-button>
      </div>
      ${p
        ? html`<sw-card heading=${`${this.userName(p.user_id)} · ${p.scope_name}`} subheading=${p.active ? `רוויזיה ${p.revision}` : 'המשתמש ללא גישה (מושבת או נמחק ב־HA)'}>
            <div class="eff">
              <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מותר בהיקף</div>${p.allowed.length ? p.allowed.map((x) => html`<div class="row"><span>${this.label(x)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`) : html`<div class="row"><span>כלום</span></div>`}</div>
              <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מחוץ להיקף / לא מוקנה</div>${p.denied.map((x) => html`<div class="row"><span>${this.label(x)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}</div>
            </div>
            ${p.bindings.length ? html`<div style="margin-block-start:10px;font-weight:600;font-size:var(--sw-fs-xs)">שיוכים שנלקחו בחשבון</div>${p.bindings.map((b) => html`<div class="bind"><div>${b.role_name} · ${b.scope_name}${b.via_group ? ` (קבוצה "${b.via_group}")` : ''}</div></div>`)}` : nothing}
            <div class="hint" style="margin-block-start:8px">תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו; החישוב נעשה בצד השרת.</div>
          </sw-card>`
        : html`<div class="hint">בחר משתמש והיקף כדי לראות מה מותר ומה לא.</div>`}
    `;
  }

  private renderAuditApi() {
    if (!this.audit) {
      void this.loadAudit();
      return html`<sw-state-panel state="loading"></sw-state-panel>`;
    }
    const columns: TableColumn[] = [
      { key: 'at', label: 'זמן', render: (r) => html`<span style="font-size:var(--sw-fs-xs)">${fmtWhen(String(r.at))}</span>` },
      { key: 'actor_username', label: 'מבצע', render: (r) => html`${String(r.actor_username ?? 'מערכת / HA')}` },
      { key: 'action', label: 'פעולה', render: (r) => html`${ACTION_LABEL[String(r.action)] ?? String(r.action)}` },
      { key: 'resource_id', label: 'משאב', render: (r) => html`${r.resource_type === 'user' ? this.userName(String(r.resource_id)) : r.resource_type === 'group' ? (this.groups?.find((g) => g.id === r.resource_id)?.name ?? String(r.resource_id)) : String(r.resource_id ?? '')}` },
      { key: 'decision', label: 'החלטה', render: (r) => html`<sw-badge kind=${r.decision === 'denied' ? 'forbidden' : 'live'} label=${r.decision === 'denied' ? `נחסם${r.reason ? ` · ${String(r.reason)}` : ''}` : 'הותר'}></sw-badge>` },
      { key: 'details', label: 'פרטים', render: (r) => { const d = r.details as Record<string, unknown>; const parts = [d.role_id ? `${String(d.role_id)}` : '', d.scope ? String(d.scope) : '', Array.isArray(d.added) && d.added.length ? `+${(d.added as string[]).length}` : '', Array.isArray(d.removed) && d.removed.length ? `−${(d.removed as string[]).length}` : '', d.revision ? `rev ${String(d.revision)}` : ''].filter(Boolean); return html`<span style="font-size:var(--sw-fs-xs);direction:ltr;unicode-bidi:isolate">${parts.join(' · ')}</span>`; } },
    ];
    return this.audit.length
      ? html`<sw-table dense .columns=${columns} .rows=${this.audit as unknown as Record<string, unknown>[]} rowKey="at"></sw-table>`
      : html`<sw-state-panel state="empty" heading="אין רשומות אודיט הרשאות" hint="כל שיוך, ביטול, קבוצה או שינוי מצב משתמש יופיע כאן."></sw-state-panel>`;
  }

  private renderApi() {
    if (this.forbidden) return html`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="forbidden" hint="צפייה בספריית המשתמשים דורשת תפקיד מנהל מערכת."></sw-state-panel></sw-page>`;
    if (this.error && !this.directory) return html`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel></sw-page>`;
    if (!this.directory || !this.roles) return html`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const dir = this.directory;
    const tabs = [
      { id: 'users', label: 'משתמשים', count: dir.users.length },
      { id: 'groups', label: 'קבוצות', count: this.groups?.length ?? 0 },
      { id: 'roles', label: 'תפקידים', count: this.roles.roles.length },
      { id: 'effective', label: 'הרשאות אפקטיביות' },
      // a delegated administrator holds no audit.read: the tab would only show a refusal
      ...(dir.delegated && !this.groupsMeta.can_manage ? [] : [{ id: 'audit', label: 'אודיט הרשאות' }]),
    ];
    const sub = dir.delegated && !this.groupsMeta.can_manage
      ? `מנהל אתר · שיוך תפקידים מרשימת ההאצלה בתוך ההיקף שלך בלבד · ${dir.users.length} משתמשים פעילים · רוויזיית הרשאות ${dir.revision}`
      : dir.directory.paired ?`זהות מ־Home Assistant · ${dir.directory.users} משתמשים בספרייה · עודכן ${fmtWhen(dir.directory.last_directory_at)} · רוויזיית הרשאות ${dir.revision}` : 'זהות מ־Home Assistant · הגשר עדיין לא מצומד: מוצגים רק משתמשים שנכנסו דרך Ingress';
    return html`
      <sw-page heading="משתמשים והרשאות" subheading=${sub}>
        ${dir.delegated ? nothing : html`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${() => this.sync()}>סנכרון משתמשים מ־HA</sw-button>`}
        <sw-tabs data-access-tabs .variant=${this.tabsMode.props('').variant} ?adaptive=${this.tabsMode.props('').adaptive} dd-style=${this.tabsMode.ddStyle} group-label="הרשאות" .items=${tabs} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => { this.tab = e.detail.id; if (this.tab === 'audit') void this.loadAudit(); }}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות. אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.</div>
        ${this.message || this.error ? html`<div class="bar">${this.message ? html`<span class="ok">${this.message}</span>` : nothing}${this.error ? html`<span class="err">${this.error}</span>` : nothing}</div>` : nothing}
        ${this.tab === 'users' ? this.renderUsersApi() : this.tab === 'groups' ? this.renderGroupsApi() : this.tab === 'roles' ? this.renderRolesApi() : this.tab === 'effective' ? this.renderEffectiveApi() : this.renderAuditApi()}
      </sw-page>
    `;
  }

  // ---- demo (fixtures) ----

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
                    <div class="hint">הרשאות בתוך Arx בלבד. שום דבר לא נכתב ל־HA. השינוי ירשם באודיט עם diff לפני/אחרי.</div>
                  </div>`
                : html`<dl>
                    <dt>מקור זהות</dt><dd>Home Assistant · <span class="ltr">${u.haUser}</span></dd>
                    <dt>סנכרון אחרון</dt><dd>${u.lastSync}</dd>
                    <dt>קבוצות</dt><dd>${u.groups.join(', ') || '—'}</dd>
                    <dt>שיוכים</dt><dd>${u.bindings.length ? u.bindings.map((b) => html`<div>${b.role} · ${b.scope}</div>`) : 'ללא: אין גישה לתוכן'}</dd>
                  </dl>
                  <div class="hint">אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד במערכת אוטומטית.</div>`}
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
    if (isApi()) return this.renderApi();
    return html`
      <sw-page heading="משתמשים והרשאות" subheading="זהות מ־Home Assistant · הרשאות בתוך Arx בלבד · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון משתמשים מ־HA</sw-button>
        <sw-tabs data-access-tabs .variant=${this.tabsMode.props('').variant} ?adaptive=${this.tabsMode.props('').adaptive} dd-style=${this.tabsMode.ddStyle} group-label="הרשאות" .items=${TABS} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות. אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.</div>
        ${this.tab === 'users' ? this.renderUsers() : this.tab === 'groups' ? this.renderGroups() : this.tab === 'roles' ? this.renderRoles() : this.tab === 'effective' ? this.renderEffective() : this.renderAudit()}
      </sw-page>
    `;
  }
}
