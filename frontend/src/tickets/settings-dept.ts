import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import './settings-sla';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import {
  ticketsApi, type AdminCategory, type AdminDepartment, type AdminTemplate, type DepartmentBody, type InstallationDefaults, type PriorityKey, type Severity,
  type TemplateBody,
} from '../api/tickets';
import { effectiveLinks, intIn, windowProblem } from './durations';
import { ticketSettingsCss } from './settings-styles';
import { tt, type TicketTextKey } from './text';

type Directory = { users: { id: string; name: string }[]; groups: { id: string; name: string }[] };
interface Drafts {
  name?: string; description?: string; reopen_days?: string; category?: string; member?: string; role?: 'manager' | 'member';
  autoDays?: string; links?: { sliding: string; cap: string; grace: string }; hours?: { from: string; to: string };
  cat?: { parent: string; prio: string; domains: string };
}
type TplDraft = { name: string; title: string; body: string; category_id: string; priority_key: string };
const SEVERITIES: Severity[] = ['info', 'alert', 'critical'];
const PRIORITY_KEYS: PriorityKey[] = ['urgent', 'high', 'normal', 'low'];
const DEFAULT_INST: InstallationDefaults = { links: { sliding_days: 14, cap_days: 90, grace_hours: 24 }, send_hours: { from: '07:00', to: '21:00' }, urgent_is_critical: true };

/**
 * CR-038 slice 2: the editor of ONE department (Settings › the module › מחלקות, section 14.2; mock-up v2 "settings-depts"): its details,
 * categories (one level; default priority; the device types that preselect it - slice 3 reads them), priorities (name, alert severity,
 * default, active), members (the escalation rule of review T19 is the server's), the department rules (history to the handler D3 / D23,
 * automatic close D10, urgent as critical D28, link lifetime D5 and vendor send hours D4 - each an override of the installation value,
 * shown next to it), the SLA grid (13.1 / D11) and the opening templates. Every write is revision-checked by the server; a 409 reloads.
 * Events: `dept-changed` {dept}, `dept-deleted` {id}, `dept-reload`, `notice` {ok | error}.
 */
@customElement('tickets-dept-editor')
export class TicketsDeptEditor extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) dept!: AdminDepartment;
  @property({ attribute: false }) directory: Directory | null = null;
  @property({ attribute: false }) installation: InstallationDefaults | null = null;
  @state() private dr: Drafts = {};
  @state() private catSel = '';
  @state() private tplOpen = '';
  @state() private tplDraft: TplDraft | null = null;
  @state() private busy = false;
  @state() private deleting = false;

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .danger {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft);
      font-size: var(--sw-fs-sm);
      overflow-wrap: anywhere;
    }
  `, bubbleChrome];

  protected willUpdate(changed: PropertyValues<this>): void {
    const prev = changed.get('dept') as AdminDepartment | undefined;
    if (prev && prev.id !== this.dept.id) {
      this.deleting = false;
      this.dr = {};
      this.catSel = '';
      this.tplOpen = '';
      this.tplDraft = null;
    }
  }

  private emit(name: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private set(patch: Drafts): void {
    this.dr = { ...this.dr, ...patch };
  }

  private async act(fn: () => Promise<AdminDepartment | void>, after?: () => void): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const d = await fn();
      if (d) this.emit('dept-changed', { dept: d });
      after?.();
      this.emit('notice', { ok: tt('setSaved') });
      this.emit('dept-reload'); // 2.5.5: the lists (members, categories, templates, counts) are re-read after every change, not patched by hand
    } catch (e) {
      this.emit('notice', { error: describeError(e) });
      if (e instanceof ApiError && e.status === 409) this.emit('dept-reload');
    } finally {
      this.busy = false;
    }
  }

  private patchDept(body: DepartmentBody, after?: () => void): Promise<void> {
    return this.act(() => ticketsApi().patchDepartment(this.dept.id, { ...body, revision: this.dept.revision }), after);
  }

  private get inst(): InstallationDefaults {
    return this.installation ?? DEFAULT_INST;
  }

  // ---------------------------------------------------------------- details

  private basicsCard(): TemplateResult {
    const d = this.dept;
    const name = this.dr.name ?? d.name;
    const desc = this.dr.description ?? d.description;
    const days = this.dr.reopen_days ?? String(d.reopen_days);
    return html`<sw-card heading=${d.name} subheading=${`${d.key} · ${tt('depOpenTickets', { n: d.open_tickets })}`} data-dept=${d.id} data-card="dept-basics">
      <div class="row"><span class="lbl">${tt('depName')}</span>
        <span class="end"><input class="in" maxlength="40" data-dept-name .value=${name} @input=${(e: Event) => this.set({ name: (e.target as HTMLInputElement).value })} />
          <sw-button size="sm" ?disabled=${this.busy || !name.trim() || name.trim() === d.name} data-dept-rename @click=${() => void this.patchDept({ name: name.trim() }, () => this.set({ name: undefined }))}>${tt('save')}</sw-button></span></div>
      <div class="row"><span class="lbl">${tt('depDescription')}</span>
        <span class="end"><input class="in" maxlength="200" data-dept-description .value=${desc} @input=${(e: Event) => this.set({ description: (e.target as HTMLInputElement).value })} />
          <sw-button size="sm" ?disabled=${this.busy || desc.trim() === d.description} data-dept-description-save @click=${() => void this.patchDept({ description: desc.trim() }, () => this.set({ description: undefined }))}>${tt('save')}</sw-button></span></div>
      <div class="row"><span class="lbl">${tt('depActive')}</span>
        <sw-toggle label=${tt('depActive')} labelHidden .checked=${d.active} ?disabled=${this.busy} data-dept-active @change=${(e: CustomEvent<{ checked: boolean }>) => void this.patchDept({ active: e.detail.checked })}></sw-toggle></div>
      <div class="row"><span class="lbl">${tt('depOpenToAll')}<span class="muted">${tt('depOpenToAllSub')}</span></span>
        <sw-toggle label=${tt('depOpenToAll')} labelHidden .checked=${d.open_to_all} ?disabled=${this.busy} data-dept-open @change=${(e: CustomEvent<{ checked: boolean }>) => void this.patchDept({ open_to_all: e.detail.checked })}></sw-toggle></div>
      <div class="row"><span class="lbl">${tt('depReopenDays')}</span>
        <span class="end"><input class="in num" type="number" min="1" max="90" data-dept-reopen .value=${days} @input=${(e: Event) => this.set({ reopen_days: (e.target as HTMLInputElement).value })} />
          <sw-button size="sm" ?disabled=${this.busy || Number(days) === d.reopen_days || Number.isNaN(intIn(days, 1, 90))} @click=${() => void this.patchDept({ reopen_days: Number(days) }, () => this.set({ reopen_days: undefined }))}>${tt('save')}</sw-button></span></div>
      ${this.categoriesRow()}
      ${this.membersRow()}
      <div class="row"><span class="lbl"></span><sw-button size="sm" variant="danger" data-dept-delete ?disabled=${this.busy || this.deleting} @click=${() => (this.deleting = true)}>${tt('depDelete')}</sw-button></div>
      ${this.deleting ? this.deleteConfirm(d) : nothing}
    </sw-card>`;
  }

  /** Owner 2026-10-14: the delete says what it affects - open tickets block it (the server refuses too), members are counted, and the
   * department can be restored from "מחלקות שנמחקו". */
  private deleteConfirm(d: AdminDepartment): TemplateResult {
    const blocked = d.open_tickets > 0;
    return html`<div class="danger" role="group" data-dept-delete-confirm data-open=${d.open_tickets} data-members=${d.members.length}>
      <b>${tt('depDeleteAsk', { name: d.name })}</b>
      ${blocked ? html`<span data-dept-delete-blocked>${tt('depDeleteBlocked', { n: d.open_tickets })}</span>`
        : html`<span>${tt('depDeleteMembers', { n: d.members.length })}</span><span>${tt('depDeleteRestorable')}</span>`}
      <span class="chipsrow">
        ${blocked ? nothing : html`<sw-button size="sm" variant="danger" data-dept-delete-ok ?disabled=${this.busy} @click=${() => void this.removeDepartment()}>${tt('depDelete')}</sw-button>`}
        <sw-button size="sm" variant="ghost" data-dept-delete-cancel @click=${() => (this.deleting = false)}>${tt('ctCancel')}</sw-button></span>
    </div>`;
  }

  private async removeDepartment(): Promise<void> {
    if (this.busy) return;
    this.deleting = false;
    this.busy = true;
    try {
      await ticketsApi().deleteDepartment(this.dept.id);
      this.emit('dept-deleted', { id: this.dept.id });
      this.emit('notice', { ok: tt('setSaved') });
    } catch (e) {
      this.emit('notice', { error: describeError(e) });
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- categories

  private catDraft(c: AdminCategory): NonNullable<Drafts['cat']> {
    return this.dr.cat ?? { parent: c.parent_id ?? '', prio: c.default_priority_id ?? '', domains: (c.domains ?? []).join(', ') };
  }

  private categoriesRow(): TemplateResult {
    const d = this.dept;
    const live = d.categories.filter((c) => c.active);
    const sel = live.find((c) => c.id === this.catSel);
    const draft = sel ? this.catDraft(sel) : null;
    const domains = draft ? draft.domains.split(',').map((x) => x.trim()).filter(Boolean) : [];
    const domainsBad = domains.some((x) => !/^[a-z][a-z0-9_]{0,39}$/.test(x)) || domains.length > 20;
    const parentName = (c: AdminCategory) => (c.parent_id ? live.find((p) => p.id === c.parent_id)?.name : null);
    return html`<div class="row stack"><span class="lbl">${tt('depCategories')}</span>
      <div class="chipsrow" data-dept-categories>${live.length ? live.map((c) => html`<span class="tag">
        <button type="button" class="tag" aria-pressed=${String(this.catSel === c.id)} data-cat=${c.id} @click=${() => { this.catSel = this.catSel === c.id ? '' : c.id; this.set({ cat: undefined }); }}>${parentName(c) ? `${bidi(parentName(c) ?? '')} › ` : ''}${bidi(c.name)}</button>
        <button type="button" class="rm" aria-label=${`${tt('depRemove')} ${c.name}`} data-cat-remove=${c.id} ?disabled=${this.busy} @click=${() => void this.act(() => ticketsApi().deleteCategory(c.id))}>×</button></span>`) : html`<span class="muted">${tt('depCatNone')}</span>`}</div>
      ${sel && draft ? html`<div class="fields" data-cat-editor=${sel.id}>
        <label class="fld">${tt('catParent')}<select class="in" data-cat-parent @change=${(e: Event) => this.set({ cat: { ...draft, parent: (e.target as HTMLSelectElement).value } })}>
          <option value="" ?selected=${!draft.parent}>${tt('catNoParent')}</option>
          ${live.filter((c) => c.id !== sel.id && !c.parent_id).map((c) => html`<option value=${c.id} ?selected=${draft.parent === c.id}>${c.name}</option>`)}
        </select></label>
        <label class="fld">${tt('catDefaultPrio')}<select class="in" data-cat-prio @change=${(e: Event) => this.set({ cat: { ...draft, prio: (e.target as HTMLSelectElement).value } })}>
          <option value="" ?selected=${!draft.prio}>${tt('catNoPrio')}</option>
          ${d.priorities.filter((p) => p.active).map((p) => html`<option value=${p.id} ?selected=${draft.prio === p.id}>${p.name}</option>`)}
        </select></label>
        <label class="fld">${tt('catDomains')}<input class="in" dir="ltr" maxlength="400" data-cat-domains aria-invalid=${String(domainsBad)} placeholder="climate, fan" .value=${draft.domains}
          @input=${(e: Event) => this.set({ cat: { ...draft, domains: (e.target as HTMLInputElement).value } })} /><span>${tt('catDomainsSub')}</span></label>
      </div>
      <div class="add"><sw-button size="sm" variant="primary" data-cat-save ?disabled=${this.busy || domainsBad}
        @click=${() => void this.act(() => ticketsApi().patchCategory(sel.id, { parent_id: draft.parent || null, default_priority_id: draft.prio || null, domains }), () => this.set({ cat: undefined }))}>${tt('save')}</sw-button></div>` : nothing}
      <div class="add"><input class="in" maxlength="60" data-cat-new placeholder=${tt('depCatAdd')} .value=${this.dr.category ?? ''} @input=${(e: Event) => this.set({ category: (e.target as HTMLInputElement).value })} />
        <sw-button size="sm" icon="plus" ?disabled=${this.busy || !(this.dr.category ?? '').trim()} data-cat-add @click=${() => void this.act(() => ticketsApi().createCategory(d.id, (this.dr.category ?? '').trim()), () => this.set({ category: '' }))}>${tt('depMemberAdd')}</sw-button></div>
    </div>`;
  }

  // ---------------------------------------------------------------- members

  private membersRow(): TemplateResult {
    const d = this.dept;
    const memberOptions = [
      ...(this.directory?.users ?? []).filter((u) => !d.members.some((m) => m.kind === 'user' && m.id === u.id)).map((u) => ({ v: `user:${u.id}`, label: u.name })),
      ...(this.directory?.groups ?? []).filter((g) => !d.members.some((m) => m.kind === 'group' && m.id === g.id)).map((g) => ({ v: `group:${g.id}`, label: `${g.name} (${tt('depGroupTag')})` })),
    ];
    return html`<div class="row stack"><span class="lbl">${tt('depMembers')}${!d.can_edit_members ? html`<span class="muted">${tt('depMembersLocked')}</span>` : nothing}</span>
      <div class="people" data-dept-members>${d.members.length ? repeat(d.members, (m) => `${m.kind}:${m.id}`, (m) => html`<div class="person" data-member=${`${m.kind}:${m.id}`}>
        <span class="who">${bidi(m.name)}${m.kind === 'group' ? html` <span class="tag">${tt('depGroupTag')}</span>` : nothing}</span>
        <span class="seg" role="radiogroup" aria-label=${m.name}>${(['manager', 'member'] as const).map((r) => html`<button type="button" role="radio" aria-pressed=${String(m.role === r)} aria-checked=${String(m.role === r)} ?disabled=${this.busy || !d.can_edit_members || m.role === r} data-member-role=${r} @click=${() => void this.act(() => ticketsApi().putMember(d.id, m.kind, m.id, r))}>${r === 'manager' ? tt('depManager') : tt('depMember')}</button>`)}</span>
        ${m.role === 'manager' && d.can_edit_members ? html`<sw-toggle label=${tt('depNotifyNew')} .checked=${m.notify_new} ?disabled=${this.busy} data-member-notify
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.act(() => ticketsApi().putMember(d.id, m.kind, m.id, m.role, e.detail.checked))}></sw-toggle>` : nothing}
        ${d.can_edit_members ? html`<button type="button" class="rm" data-member-remove ?disabled=${this.busy} @click=${() => void this.act(() => ticketsApi().deleteMember(d.id, m.kind, m.id))}>${tt('depRemove')}</button>` : nothing}
      </div>`) : html`<span class="muted">${tt('depNoMembers')}</span>`}</div>
      ${d.can_edit_members ? html`<div class="add">
        <select class="in" data-member-pick aria-label=${tt('depMemberPick')} @change=${(e: Event) => this.set({ member: (e.target as HTMLSelectElement).value })}>
          <option value="" ?selected=${!this.dr.member}>${tt('depMemberPick')}</option>
          ${memberOptions.map((o) => html`<option value=${o.v} ?selected=${this.dr.member === o.v}>${o.label}</option>`)}
        </select>
        <select class="in" data-member-new-role aria-label=${tt('depMembers')} @change=${(e: Event) => this.set({ role: (e.target as HTMLSelectElement).value as 'manager' | 'member' })}>
          <option value="member" ?selected=${(this.dr.role ?? 'member') === 'member'}>${tt('depMember')}</option>
          <option value="manager" ?selected=${this.dr.role === 'manager'}>${tt('depManager')}</option>
        </select>
        <sw-button size="sm" icon="plus" ?disabled=${this.busy || !this.dr.member} data-member-add @click=${() => { const [kind, ...rest] = (this.dr.member ?? '').split(':'); void this.act(() => ticketsApi().putMember(d.id, kind as 'user' | 'group', rest.join(':'), this.dr.role ?? 'member'), () => this.set({ member: '' })); }}>${tt('depMemberAdd')}</sw-button>
      </div>` : nothing}</div>`;
  }

  // ---------------------------------------------------------------- priorities

  private prioritiesCard(): TemplateResult {
    const d = this.dept;
    return html`<sw-card heading=${tt('depPriorities')} data-card="dept-priorities">
      ${d.priorities.map((p) => html`<div class="row" data-prio=${p.key}>
        <span class="end start">
          <input class="in" maxlength="30" aria-label=${`${tt('depPrioName')} · ${p.name}`} data-prio-name=${p.key} .value=${p.name}
            @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); if (v && v !== p.name) void this.act(() => ticketsApi().patchPriority(p.id, { name: v })); }} />
          <select class="in" aria-label=${`${tt('depPrioSeverity')} · ${p.name}`} data-prio-severity=${p.key} ?disabled=${this.busy}
            @change=${(e: Event) => void this.act(() => ticketsApi().patchPriority(p.id, { notify_severity: (e.target as HTMLSelectElement).value as Severity }))}>
            ${SEVERITIES.map((s) => html`<option value=${s} ?selected=${p.severity === s}>${tt(`sev_${s}` as TicketTextKey)}</option>`)}
          </select></span>
        <span class="end">
          ${p.is_default ? html`<span class="tag ok" data-prio-default=${p.key}>${tt('depDefault')}</span>`
            : html`<button type="button" class="rc" data-prio-make-default=${p.key} ?disabled=${this.busy || !p.active} @click=${() => void this.act(() => ticketsApi().patchPriority(p.id, { is_default: true }))}>${tt('depMakeDefault')}</button>`}
          <sw-toggle label=${tt('depPrioActive')} .checked=${p.active} ?disabled=${this.busy || p.is_default} data-prio-active=${p.key}
            @change=${(e: CustomEvent<{ checked: boolean }>) => void this.act(() => ticketsApi().patchPriority(p.id, { active: e.detail.checked }))}></sw-toggle>
        </span></div>`)}
    </sw-card>`;
  }

  // ---------------------------------------------------------------- the department rules (policy)

  private policyCard(): TemplateResult {
    const d = this.dept;
    const o = d.overrides;
    const inst = this.inst;
    const auto = d.auto_close_after_days;
    const autoDays = this.dr.autoDays ?? String(auto ?? 3);
    const linksOwn = o.link_sliding_days !== null || o.link_cap_days !== null || o.link_grace_hours !== null || this.dr.links !== undefined;
    const eff = effectiveLinks(inst.links, o);
    const ld = this.dr.links ?? { sliding: String(eff.sliding_days), cap: String(eff.cap_days), grace: String(eff.grace_hours) };
    const sliding = intIn(ld.sliding, 1, 90);
    const cap = intIn(ld.cap, 7, 365);
    const grace = intIn(ld.grace, 0, 168);
    const linkErr = Number.isNaN(sliding) || Number.isNaN(cap) || Number.isNaN(grace) ? 'range' : cap < sliding ? 'below_sliding' : null;
    const hoursOwn = o.send_hours !== null || this.dr.hours !== undefined;
    const hd = this.dr.hours ?? (o.send_hours ?? inst.send_hours);
    const hoursErr = windowProblem(hd.from, hd.to);
    const urgent = o.urgent_is_critical;
    return html`<sw-card heading=${tt('depPolicy')} data-card="dept-policy">
      <div class="row"><span class="lbl">${tt('depHistory')}<span class="muted">${tt('depHistorySub')}</span></span>
        <sw-toggle label=${tt('depHistory')} labelHidden .checked=${d.share_history_external} ?disabled=${this.busy} data-dept-history
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.patchDept({ share_history_external: e.detail.checked })}></sw-toggle></div>
      <div class="row"><span class="lbl">${tt('depAutoClose')}<span class="muted">${tt('depAutoCloseSub')}</span></span>
        <span class="end">${auto !== null ? html`<span class="unit"><span class="muted">${tt('depAutoCloseDays')}</span>
            <input class="in num" type="number" min="1" max="30" data-dept-autoclose-days aria-label=${tt('depAutoCloseDays')} aria-invalid=${String(Number.isNaN(intIn(autoDays, 1, 30)))} .value=${autoDays}
              @input=${(e: Event) => this.set({ autoDays: (e.target as HTMLInputElement).value })} />
            <sw-button size="sm" ?disabled=${this.busy || Number(autoDays) === auto || Number.isNaN(intIn(autoDays, 1, 30))} data-dept-autoclose-save
              @click=${() => void this.patchDept({ auto_close_after_days: Number(autoDays) }, () => this.set({ autoDays: undefined }))}>${tt('save')}</sw-button></span>` : nothing}
          <sw-toggle label=${tt('depAutoClose')} labelHidden .checked=${auto !== null} ?disabled=${this.busy} data-dept-autoclose
            @change=${(e: CustomEvent<{ checked: boolean }>) => void this.patchDept({ auto_close_after_days: e.detail.checked ? (Number.isNaN(intIn(autoDays, 1, 30)) ? 3 : Number(autoDays)) : null }, () => this.set({ autoDays: undefined }))}></sw-toggle></span></div>
      <div class="row"><span class="lbl">${tt('depUrgent')}</span>
        <span class="seg" role="radiogroup" aria-label=${tt('depUrgent')}>${([null, true, false] as (boolean | null)[]).map((v) => html`<button type="button" role="radio"
          aria-pressed=${String(urgent === v)} aria-checked=${String(urgent === v)} ?disabled=${this.busy} data-dept-urgent=${v === null ? 'inherit' : String(v)}
          @click=${() => urgent !== v && void this.patchDept({ urgent_is_critical: v })}>${v === null ? tt('depUrgentInherit', { v: inst.urgent_is_critical ? tt('yes') : tt('no') }) : v ? tt('yes') : tt('no')}</button>`)}</span></div>
      <div class="row stack" data-dept-links-row><span class="lbl">${tt('depLinks')}<span class="muted">${tt('depLinksSub', { s: inst.links.sliding_days, c: inst.links.cap_days, g: inst.links.grace_hours })}</span></span>
        <div class="add"><sw-toggle label=${tt('depOwn')} .checked=${linksOwn} ?disabled=${this.busy} data-dept-links-own
          @change=${(e: CustomEvent<{ checked: boolean }>) => {
            if (e.detail.checked) this.set({ links: { sliding: String(eff.sliding_days), cap: String(eff.cap_days), grace: String(eff.grace_hours) } });
            else void this.patchDept({ link_sliding_days: null, link_cap_days: null, link_grace_hours: null }, () => this.set({ links: undefined }));
          }}></sw-toggle></div>
        ${linksOwn ? html`<div class="fields">
          <label class="fld">${tt('setLinksSliding')} (${tt('unit_d')})<input class="in num" type="number" min="1" max="90" data-dept-link="sliding" aria-invalid=${String(Number.isNaN(sliding) || linkErr === 'below_sliding')} .value=${ld.sliding} @input=${(e: Event) => this.set({ links: { ...ld, sliding: (e.target as HTMLInputElement).value } })} /></label>
          <label class="fld">${tt('setLinksCap')} (${tt('unit_d')})<input class="in num" type="number" min="7" max="365" data-dept-link="cap" aria-invalid=${String(Number.isNaN(cap) || linkErr === 'below_sliding')} .value=${ld.cap} @input=${(e: Event) => this.set({ links: { ...ld, cap: (e.target as HTMLInputElement).value } })} /></label>
          <label class="fld">${tt('setLinksGrace')} (${tt('unit_h')})<input class="in num" type="number" min="0" max="168" data-dept-link="grace" aria-invalid=${String(Number.isNaN(grace))} .value=${ld.grace} @input=${(e: Event) => this.set({ links: { ...ld, grace: (e.target as HTMLInputElement).value } })} /></label>
        </div>
        <div class="add"><sw-button size="sm" variant="primary" data-dept-links-save ?disabled=${this.busy || !!linkErr || !this.dr.links}
          @click=${() => void this.patchDept({ link_sliding_days: sliding, link_cap_days: cap, link_grace_hours: grace }, () => this.set({ links: undefined }))}>${tt('save')}</sw-button>
          ${linkErr && this.dr.links ? html`<span class="field-error">${tt(`err_${linkErr}` as TicketTextKey)}</span>` : nothing}</div>` : nothing}
      </div>
      <div class="row stack" data-dept-hours-row><span class="lbl">${tt('depHours')}<span class="muted">${tt('depHoursSub', { from: inst.send_hours.from, to: inst.send_hours.to })}</span></span>
        <div class="add"><sw-toggle label=${tt('depOwn')} .checked=${hoursOwn} ?disabled=${this.busy} data-dept-hours-own
          @change=${(e: CustomEvent<{ checked: boolean }>) => {
            if (e.detail.checked) this.set({ hours: { ...(o.send_hours ?? inst.send_hours) } });
            else void this.patchDept({ send_hours: null }, () => this.set({ hours: undefined }));
          }}></sw-toggle></div>
        ${hoursOwn ? html`<div class="add">
          <input class="in time" type="time" data-dept-hours="from" aria-label=${tt('depHours')} aria-invalid=${String(!!hoursErr)} .value=${hd.from} @input=${(e: Event) => this.set({ hours: { ...hd, from: (e.target as HTMLInputElement).value } })} />
          <span class="muted">${tt('hoursTo')}</span>
          <input class="in time" type="time" data-dept-hours="to" aria-label=${`${tt('depHours')} · ${tt('hoursTo')}`} aria-invalid=${String(!!hoursErr)} .value=${hd.to} @input=${(e: Event) => this.set({ hours: { ...hd, to: (e.target as HTMLInputElement).value } })} />
          <sw-button size="sm" variant="primary" data-dept-hours-save ?disabled=${this.busy || !!hoursErr || !this.dr.hours}
            @click=${() => void this.patchDept({ send_hours: { from: hd.from, to: hd.to } }, () => this.set({ hours: undefined }))}>${tt('save')}</sw-button>
          ${hoursErr ? html`<span class="field-error">${tt(`err_${hoursErr}` as TicketTextKey)}</span>` : nothing}
        </div>` : nothing}
      </div>
    </sw-card>`;
  }

  // ---------------------------------------------------------------- templates

  private openTpl(t: AdminTemplate | null): void {
    if (t && this.tplOpen === t.id) {
      this.tplOpen = '';
      this.tplDraft = null;
      return;
    }
    this.tplOpen = t ? t.id : 'new';
    this.tplDraft = { name: t?.name ?? '', title: t?.title ?? '', body: t?.body ?? '', category_id: t?.category_id ?? '', priority_key: t?.priority_key ?? '' };
  }

  private tplForm(t: AdminTemplate | null): TemplateResult {
    const f = this.tplDraft!;
    const upd = (patch: Partial<TplDraft>) => (this.tplDraft = { ...f, ...patch });
    const body: TemplateBody = { name: f.name.trim(), title: f.title.trim(), body: f.body.trim(), category_id: f.category_id || null, priority_key: (f.priority_key || null) as PriorityKey | null };
    const done = () => { this.tplOpen = ''; this.tplDraft = null; };
    return html`<div class="fields" data-tpl-form=${t?.id ?? 'new'}>
        <label class="fld">${tt('tplName')}<input class="in" maxlength="60" data-tpl-name .value=${f.name} @input=${(e: Event) => upd({ name: (e.target as HTMLInputElement).value })} /></label>
        <label class="fld">${tt('tplTitle')}<input class="in" maxlength="120" data-tpl-title .value=${f.title} @input=${(e: Event) => upd({ title: (e.target as HTMLInputElement).value })} /></label>
        <label class="fld">${tt('tplCategory')}<select class="in" data-tpl-category @change=${(e: Event) => upd({ category_id: (e.target as HTMLSelectElement).value })}>
          <option value="" ?selected=${!f.category_id}>${tt('tplAny')}</option>
          ${this.dept.categories.filter((c) => c.active).map((c) => html`<option value=${c.id} ?selected=${f.category_id === c.id}>${c.name}</option>`)}</select></label>
        <label class="fld">${tt('tplPriority')}<select class="in" data-tpl-priority @change=${(e: Event) => upd({ priority_key: (e.target as HTMLSelectElement).value })}>
          <option value="" ?selected=${!f.priority_key}>${tt('tplAny')}</option>
          ${PRIORITY_KEYS.map((k) => html`<option value=${k} ?selected=${f.priority_key === k}>${this.dept.priorities.find((p) => p.key === k)?.name ?? k}</option>`)}</select></label>
      </div>
      <label class="fld">${tt('tplBody')}<textarea class="in" maxlength="4000" data-tpl-body .value=${f.body} @input=${(e: Event) => upd({ body: (e.target as HTMLTextAreaElement).value })}></textarea></label>
      <div class="add">
        <sw-button size="sm" variant="primary" data-tpl-save ?disabled=${this.busy || !f.name.trim()}
          @click=${() => void this.act(() => (t ? ticketsApi().patchTemplate(t.id, { ...body, revision: t.revision }) : ticketsApi().createTemplate(this.dept.id, body)), done)}>${tt('save')}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${done}>${tt('cancel')}</sw-button>
        ${t ? html`<span class="grow"></span><sw-button size="sm" variant="danger" data-tpl-delete ?disabled=${this.busy} @click=${() => void this.act(() => ticketsApi().deleteTemplate(t.id), done)}>${tt('depRemove')}</sw-button>` : nothing}
      </div>`;
  }

  private templatesCard(): TemplateResult {
    const list = this.dept.templates;
    return html`<sw-card heading=${tt('tplCard')} data-card="dept-templates">
      <div class="stack">
        ${list.length ? list.map((t) => html`<div class="tpl" data-tpl=${t.id}>
          <div class="tplhead"><span class="nm">${bidi(t.name)}</span>
            <span class="end"><sw-toggle label=${tt('tplActive')} .checked=${t.active} ?disabled=${this.busy} data-tpl-active
              @change=${(e: CustomEvent<{ checked: boolean }>) => void this.act(() => ticketsApi().patchTemplate(t.id, { active: e.detail.checked, revision: t.revision }))}></sw-toggle>
              <sw-button size="sm" variant="ghost" data-tpl-edit @click=${() => this.openTpl(t)}>${tt('depEdit')}</sw-button></span></div>
          ${this.tplOpen === t.id && this.tplDraft ? this.tplForm(t) : t.title ? html`<span class="muted">${t.title}</span>` : nothing}
        </div>`) : html`<span class="muted">${tt('tplNone')}</span>`}
        ${this.tplOpen === 'new' && this.tplDraft ? html`<div class="tpl" data-tpl="new">${this.tplForm(null)}</div>`
          : html`<div class="add"><sw-button size="sm" icon="plus" data-tpl-new ?disabled=${this.busy || list.length >= 50} @click=${() => this.openTpl(null)}>${tt('tplNew')}</sw-button></div>`}
      </div>
    </sw-card>`;
  }

  render() {
    if (!this.dept) return nothing;
    return html`
      ${this.basicsCard()}
      ${this.policyCard()}
      <sw-card heading=${tt('slaCard')} data-card="dept-sla"><tickets-sla-grid .dept=${this.dept}></tickets-sla-grid></sw-card>
      ${this.prioritiesCard()}
      ${this.templatesCard()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-dept-editor': TicketsDeptEditor;
  }
}
