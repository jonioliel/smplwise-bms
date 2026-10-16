import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LiveRefresh } from './live-refresh';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-state-panel';
import { settingsStyles } from '../styles/settings';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type AdminDepartment, type AdminMember } from '../api/tickets';
import { ticketSettingsCss } from './settings-styles';
import { handlersGlass } from './handlers-glass';
import { seesLoad, type MemberLoad } from './handler-load';
import { tIcon } from './icons';
import { tt } from './text';

type Role = 'manager' | 'member';
type Lang = 'he' | 'en' | 'ar' | 'ru';
const LANGS: Lang[] = ['he', 'ar', 'ru', 'en'];
type Directory = { users: { id: string; name: string }[]; groups: { id: string; name: string }[] };

interface Person { key: string; kind: 'user' | 'group'; id: string; name: string; ms: { d: AdminDepartment; m: AdminMember }[] }
const initials = (name: string): string => name.trim().split(/\s+/).slice(0, 2).map((s) => s[0] ?? '').join('');

/**
 * CR-038 owner request 2026-10-14: "מטפלים וספקים" › מטפלים › "עם חשבון במערכת" - the handlers who have an Arx account are the members
 * of a department (slice 2's member routes; the server's rules are unchanged: tickets.configure, and a member edit also needs to manage
 * the department or tickets.all_departments - `can_edit_members`; nobody makes themself a manager). TKUI6 (2.6.0, mock-up v5): one card
 * per member (a tile, the name, the role chip, the three counts of the load - ONLY for the manager of that department -, the mobile state,
 * "ניהול" that opens the card's own panel: role, the new-request alert of a manager, the mobile line and "הסרה"), the departments as
 * sections (the page's department chip narrows them; the page's search narrows by name), and a panel to add a user or a group
 * (opened by the page's "+ מטפל"). Without tickets.configure the department list answers 403 and nothing is shown (a manager reads the
 * employees and vendors below).
 * TKSTAFF1 (owner 2026-10-16): every user member has a mobile line - the number (the server validates E.164), the language of the
 * messages and the user's "WhatsApp on assignment" switch (PUT /tickets/admin/staff/{user_id}, tickets.configure). With a mobile, an
 * assignment sends the employee a WhatsApp message with a personal no-login link (services/tickets/staff_links.py) - once the employee
 * confirmed the number in their own account (security review F3; until then the card says so). A manager may only turn the switch off.
 * Events: `notice` {ok | error}, `add-done` (the add panel did its work).
 */
@customElement('tickets-handlers-members')
export class TicketsHandlersMembers extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  /** the page's department chip ('' = all) and search text */
  @property() dept = '';
  @property() query = '';
  /** the load by assignee key (`user:<id>`), from the board; null = not available (the viewer manages no department) */
  @property({ attribute: false }) loads: Map<string, MemberLoad> | null = null;
  /** the departments the viewer manages: only there the load is shown (owner decision TKUI6) */
  @property({ attribute: false }) managed: readonly string[] = [];
  /** the page's "+ מטפל": the add panel is open */
  @property({ type: Boolean }) adding = false;
  @state() private depts: AdminDepartment[] | null = null;
  @state() private directory: Directory | null = null;
  @state() private addDept = '';
  @state() private pick = '';
  @state() private newRole: Role = 'member';
  @state() private busy = false;
  @state() private denied = false;
  @state() private open = new Set<string>();
  @state() private drafts: Record<string, { phone: string; lang: Lang }> = {};

  static styles = [bubbleChrome, ...automationsStyles, settingsStyles, ticketSettingsCss, handlersGlass, css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .dsec {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .dsec > h3 {
      margin: 0;
      padding-inline: 4px;
      font-size: var(--sw-fs-md);
      font-weight: 700;
      color: var(--dv-text-2);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .hcard.open {
      grid-column: 1 / -1;
    }
    .manage .in,
    .addp .in {
      min-block-size: 44px;
      border-radius: var(--dv-radius-control);
      border-color: var(--dv-border);
      background: var(--dv-surface-2);
    }
    .manage .tel {
      inline-size: 14em;
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    .manage .seg button {
      min-block-size: 36px;
    }
    .manage .seg button[disabled] {
      cursor: default;
    }
    .rb.sm {
      inline-size: 40px;
      block-size: 40px;
    }
  `];

  private live = new LiveRefresh(() => {
    if (!this.busy && !this.hidden) void this.load();
  });

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.live.start();
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.live.stop();
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  private async load(): Promise<void> {
    try {
      const r = await ticketsApi().departments();
      this.depts = r.departments.filter((d) => d.active);
      if (!this.depts.some((d) => d.id === this.addDept)) this.addDept = this.depts.find((d) => d.can_edit_members)?.id ?? this.depts[0]?.id ?? '';
      if (!this.directory) this.directory = await ticketsApi().directory();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        this.denied = true;
        this.hidden = true; // the section is not shown without tickets.configure
      } else {
        this.depts = [];
        this.notice({ error: describeError(e) });
      }
    }
  }

  private async act(fn: () => Promise<AdminDepartment>, after?: () => void): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const d = await fn();
      this.depts = (this.depts ?? []).map((x) => (x.id === d.id ? d : x));
      after?.();
      this.notice({ ok: tt('setSaved') });
      void this.load(); // 2.5.5: re-read after every change
    } catch (e) {
      this.notice({ error: describeError(e) });
      if (e instanceof ApiError && e.status === 409) await this.load();
    } finally {
      this.busy = false;
    }
  }

  private draftOf(m: AdminMember): { phone: string; lang: Lang } {
    return this.drafts[m.id] ?? { phone: m.mobile ?? '', lang: m.lang ?? 'he' };
  }

  private setDraft(m: AdminMember, patch: Partial<{ phone: string; lang: Lang }>): void {
    this.drafts = { ...this.drafts, [m.id]: { ...this.draftOf(m), ...patch } };
  }

  private async saveStaff(m: AdminMember, body: { phone?: string | null; lang?: Lang; notify_whatsapp?: boolean }): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await ticketsApi().putStaffMobile(m.id, body);
      const { [m.id]: _gone, ...rest } = this.drafts;
      this.drafts = rest;
      this.notice({ ok: tt('setSaved') });
      await this.load();
    } catch (e) {
      this.notice({ error: describeError(e) });
    } finally {
      this.busy = false;
    }
  }

  private mobileOf(m: AdminMember): TemplateResult {
    const dr = this.draftOf(m);
    const dirty = dr.phone.trim() !== (m.mobile ?? '') || dr.lang !== (m.lang ?? 'he');
    return html`<div class="line" data-member-mobile=${m.id}>
      <span class="lbl">${tt('hdMobile')}</span>
      <input class="in tel" type="tel" dir="ltr" inputmode="tel" autocomplete="off" maxlength="40" aria-label=${`${tt('hdMobile')} · ${m.name}`}
        placeholder=${tt('hdMobile')} .value=${dr.phone} ?disabled=${this.busy} data-member-mobile-input
        @input=${(e: Event) => this.setDraft(m, { phone: (e.target as HTMLInputElement).value })}>
      <select class="in" aria-label=${tt('hdMobileLang')} ?disabled=${this.busy} data-member-mobile-lang
        @change=${(e: Event) => this.setDraft(m, { lang: (e.target as HTMLSelectElement).value as Lang })}>
        ${LANGS.map((l) => html`<option value=${l} ?selected=${dr.lang === l}>${tt(`lang_${l}`)}</option>`)}
      </select>
      <sw-button size="sm" ?disabled=${this.busy || !dirty} data-member-mobile-save
        @click=${() => void this.saveStaff(m, { phone: dr.phone.trim() || null, lang: dr.lang })}>${tt('hdMobileSave')}</sw-button>
      ${m.mobile && m.mobile_confirmed === false ? html`<span class="chip warn" data-member-mobile-pending>${tt('hdMobilePending')}</span>` : nothing}
      ${m.mobile ? html`<sw-toggle label=${tt('hdMobileWhatsapp')} .checked=${m.notify_whatsapp !== false} ?disabled=${this.busy || m.notify_whatsapp === false} data-member-whatsapp
        @change=${(e: CustomEvent<{ checked: boolean }>) => void this.saveStaff(m, { notify_whatsapp: e.detail.checked })}></sw-toggle>` : nothing}
    </div>`;
  }

  private add(): void {
    const d = (this.depts ?? []).find((x) => x.id === this.addDept);
    const [kind, ...rest] = this.pick.split(':');
    if (!d || !this.pick) return;
    void this.act(() => ticketsApi().putMember(d.id, kind as 'user' | 'group', rest.join(':'), this.newRole), () => {
      this.pick = '';
      this.dispatchEvent(new CustomEvent('add-done', { bubbles: true, composed: true }));
    });
  }

  private toggle(key: string): void {
    const next = new Set(this.open);
    if (!next.delete(key)) next.add(key);
    this.open = next;
  }

  /** The count line of a user member; only for a manager of one of the person's departments, and only when the board answered. */
  private statsOf(p: Person): TemplateResult | typeof nothing {
    if (p.kind !== 'user' || !this.loads || !seesLoad(this.managed, p.ms.map((x) => x.d.id))) return nothing;
    const l = this.loads.get(`user:${p.id}`) ?? { open: 0, waiting: 0, stuck: 0 };
    return html`<div class="stats" data-member-stats>
      <div><b data-stat="open">${l.open}</b>${tt('u6Open')}</div>
      <div><b class=${l.waiting ? 'warn' : ''} data-stat="waiting">${l.waiting}</b>${tt('u6WaitingHim')}</div>
      <div><b class=${l.stuck ? 'bad' : ''} data-stat="stuck">${l.stuck}</b>${tt('u6Stuck')}</div>
    </div>`;
  }

  /** One department's membership of the person: the role, the new-request alert of a manager, "הסרה". */
  private membership(d: AdminDepartment, m: AdminMember, many: boolean): TemplateResult {
    const edit = d.can_edit_members;
    return html`<div class="line" data-member-membership=${d.id}>
      <span class="lbl">${many ? bidi(d.name) : tt('u6MemberRole')}</span>
      <span class="seg" role="radiogroup" aria-label=${`${m.name} · ${d.name}`}>${(['manager', 'member'] as const).map((r) => html`<button type="button" role="radio" aria-pressed=${String(m.role === r)}
        aria-checked=${String(m.role === r)} ?disabled=${this.busy || !edit || m.role === r} data-member-role=${r}
        @click=${() => void this.act(() => ticketsApi().putMember(d.id, m.kind, m.id, r))}>${r === 'manager' ? tt('hdRole_manager') : tt('hdRole_member')}</button>`)}</span>
      ${m.role === 'manager' && edit ? html`<sw-toggle label=${tt('depNotifyNew')} .checked=${m.notify_new} ?disabled=${this.busy} data-member-notify
        @change=${(e: CustomEvent<{ checked: boolean }>) => void this.act(() => ticketsApi().putMember(d.id, m.kind, m.id, m.role, e.detail.checked))}></sw-toggle>` : nothing}
      ${edit ? html`<button type="button" class="rm" data-member-remove ?disabled=${this.busy} @click=${() => void this.act(() => ticketsApi().deleteMember(d.id, m.kind, m.id))}>${tt('depRemove')}</button>` : nothing}
    </div>`;
  }

  private card(p: Person): TemplateResult {
    const open = this.open.has(p.key);
    const group = p.kind === 'group';
    const first = p.ms[0].m;
    const manager = p.ms.some((x) => x.m.role === 'manager');
    const pending = !group && !!first.mobile && first.mobile_confirmed === false;
    return html`<article class=${`glass hcard ${open ? 'open' : ''}`} data-member=${p.key}>
      <header>
        <span class=${`tile ${group ? 'grp' : 'int'}`} aria-hidden="true">${group ? tIcon('users') : initials(p.name)}</span>
        <div class="t"><h3>${bidi(p.name)}</h3>
          <div class="role">${group ? tt('u6Group') : tt('hdRole_member')}${manager ? html`<span class="chip xs info" data-member-manager-chip>${tt('u6Manager')}</span>` : nothing}</div></div>
        <button type="button" class="rb sm" data-member-toggle aria-expanded=${String(open)} aria-label=${`${open ? tt('u6CloseManage') : tt('u6Manage')} · ${p.name}`} title=${open ? tt('u6CloseManage') : tt('u6Manage')}
          @click=${() => this.toggle(p.key)}>${open ? tIcon('x') : tIcon('dots')}</button>
      </header>
      ${this.statsOf(p)}
      <footer>
        ${p.ms.map((x) => html`<span class="chip">${bidi(x.d.name)}</span>`)}
        ${!group && first.mobile && first.notify_whatsapp !== false ? html`<span class="chip wa" data-member-wa>${tIcon('send')}${tt('ch_whatsapp')}</span>` : nothing}
        ${pending ? html`<span class="chip warn" data-member-pending-chip>${tt('hdMobilePending')}</span>` : nothing}
      </footer>
      ${open ? html`<div class="manage" data-member-panel>
        ${p.ms.map((x) => this.membership(x.d, x.m, p.ms.length > 1))}
        ${group ? nothing : this.mobileOf(first)}
      </div>` : nothing}
    </article>`;
  }

  private addPanel(): TemplateResult | typeof nothing {
    const depts = (this.depts ?? []).filter((d) => d.can_edit_members);
    const d = depts.find((x) => x.id === this.addDept) ?? depts[0];
    if (!d) return nothing;
    const options = [
      ...(this.directory?.users ?? []).filter((u) => !d.members.some((m) => m.kind === 'user' && m.id === u.id)).map((u) => ({ v: `user:${u.id}`, label: u.name })),
      ...(this.directory?.groups ?? []).filter((g) => !d.members.some((m) => m.kind === 'group' && m.id === g.id)).map((g) => ({ v: `group:${g.id}`, label: `${g.name} (${tt('depGroupTag')})` })),
    ];
    return html`<div class="glass addp" data-members-add role="group" aria-label=${tt('u6AddMember')}>
      ${depts.length > 1 ? html`<select class="in" data-member-dept-pick aria-label=${tt('hdDepartment')} @change=${(e: Event) => { this.addDept = (e.target as HTMLSelectElement).value; this.pick = ''; }}>
        ${depts.map((x) => html`<option value=${x.id} ?selected=${x.id === d.id}>${bidi(x.name)}</option>`)}</select>` : nothing}
      <select class="in" data-member-pick aria-label=${tt('hdMemberPick')} @change=${(e: Event) => (this.pick = (e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${!this.pick}>${tt('hdMemberPick')}</option>
        ${options.map((o) => html`<option value=${o.v} ?selected=${this.pick === o.v}>${o.label}</option>`)}
      </select>
      <select class="in" data-member-new-role aria-label=${tt('depMembers')} @change=${(e: Event) => (this.newRole = (e.target as HTMLSelectElement).value as Role)}>
        <option value="member" ?selected=${this.newRole === 'member'}>${tt('hdRole_member')}</option>
        <option value="manager" ?selected=${this.newRole === 'manager'}>${tt('hdRole_manager')}</option>
      </select>
      <button type="button" class="btn primary" data-member-add ?disabled=${this.busy || !this.pick} @click=${() => this.add()}>${tIcon('plus')}${tt('depMemberAdd')}</button>
    </div>`;
  }

  /** The people of the shown departments: one card per person (a user or a group), with every membership of it. */
  private people(): Person[] {
    const q = this.query.trim().toLowerCase();
    const out = new Map<string, Person>();
    for (const d of (this.depts ?? []).filter((x) => !this.dept || x.id === this.dept)) {
      for (const m of d.members) {
        if (q && !m.name.toLowerCase().includes(q)) continue;
        const key = `${m.kind}:${m.id}`;
        const p = out.get(key) ?? { key, kind: m.kind, id: m.id, name: m.name, ms: [] };
        p.ms.push({ d, m });
        out.set(key, p);
      }
    }
    return [...out.values()];
  }

  render() {
    if (this.denied) return nothing;
    if (this.depts === null) return html`<div class="sec"><div class="glass" style="padding:18px"><span class="skl" style="block-size:20px;inline-size:40%"></span></div></div>`;
    const people = this.people();
    const empty = this.query.trim() ? tt('u6NoMatch') : tt('hdMembersEmpty');
    return html`<div class="sec" data-card="handlers-members" data-handlers-members>
      <div class="sh"><h2>${tt('u6SecMembers')}<span class="n">${people.length}</span></h2><small>${tt('u6SecMembersSub')}</small></div>
      ${this.adding ? this.addPanel() : nothing}
      ${this.depts.length
        ? (people.length ? html`<div class="cgrid" data-members-grid>${repeat(people, (p) => p.key, (p) => this.card(p))}</div>` : html`<span class="mut" data-members-empty>${empty}</span>`)
        : html`<sw-state-panel state="empty" heading=${tt('hdNoDepartments')}></sw-state-panel>
          <div class="foot"><a href="#/system/tickets?tab=departments" data-to-departments>${tt('setTabDepartments')}</a></div>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-handlers-members': TicketsHandlersMembers;
  }
}
