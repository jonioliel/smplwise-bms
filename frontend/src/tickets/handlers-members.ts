import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LiveRefresh } from './live-refresh';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-state-panel';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type AdminDepartment, type AdminMember } from '../api/tickets';
import { ticketSettingsCss } from './settings-styles';
import { tt } from './text';

type Role = 'manager' | 'member';
type Lang = 'he' | 'en' | 'ar' | 'ru';
const LANGS: Lang[] = ['he', 'ar', 'ru', 'en'];
type Directory = { users: { id: string; name: string }[]; groups: { id: string; name: string }[] };

/**
 * CR-038 owner request 2026-10-14: "מטפלים וספקים" › מטפלים › "עם חשבון במערכת" - the handlers who have an Arx account are the members
 * of a department (slice 2's member routes; the server's rules are unchanged: tickets.configure, and a member edit also needs to manage
 * the department or tickets.all_departments - `can_edit_members`; nobody makes themself a manager). A department chooser, the members
 * of the chosen one (role manager / handler, the new-ticket alert for a manager, remove) and a people picker to add a user or a group.
 * Without tickets.configure the department list answers 403 and this card is not shown (a manager reads the employees and vendors below).
 * TKSTAFF1 (owner 2026-10-16): every user member has a mobile line - the number (the server validates E.164), the language of the
 * messages and the user's "WhatsApp on assignment" switch (PUT /tickets/admin/staff/{user_id}, tickets.configure). With a mobile, an
 * assignment sends the employee a WhatsApp message with a personal no-login link (services/tickets/staff_links.py).
 * Events: `notice` {ok | error}.
 */
@customElement('tickets-handlers-members')
export class TicketsHandlersMembers extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private depts: AdminDepartment[] | null = null;
  @state() private directory: Directory | null = null;
  @state() private selected = '';
  @state() private pick = '';
  @state() private newRole: Role = 'member';
  @state() private busy = false;
  @state() private denied = false;
  @state() private drafts: Record<string, { phone: string; lang: Lang }> = {};

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    .depts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .add .in {
      min-inline-size: 0;
    }
    .person .who {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .staff {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding-inline-start: 12px;
      margin-block-end: 6px;
    }
    .staff .tel {
      inline-size: 14em;
      max-inline-size: 100%;
      min-inline-size: 0;
    }
  `, bubbleChrome];

  private live = new LiveRefresh(() => {
    if (!this.busy && !this.hidden) void this.load();
  });

  connectedCallback(): void {
    super.connectedCallback();
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
      if (!this.depts.some((d) => d.id === this.selected)) this.selected = this.depts[0]?.id ?? '';
      if (!this.directory) this.directory = await ticketsApi().directory();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        this.denied = true;
        this.hidden = true; // the card is not shown without tickets.configure
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
    return html`<div class="staff" data-member-mobile=${m.id}>
      <input class="in tel" type="tel" dir="ltr" inputmode="tel" autocomplete="off" maxlength="40" aria-label=${`${tt('hdMobile')} · ${m.name}`}
        placeholder=${tt('hdMobile')} .value=${dr.phone} ?disabled=${this.busy} data-member-mobile-input
        @input=${(e: Event) => this.setDraft(m, { phone: (e.target as HTMLInputElement).value })}>
      <select class="in" aria-label=${tt('hdMobileLang')} ?disabled=${this.busy} data-member-mobile-lang
        @change=${(e: Event) => this.setDraft(m, { lang: (e.target as HTMLSelectElement).value as Lang })}>
        ${LANGS.map((l) => html`<option value=${l} ?selected=${dr.lang === l}>${tt(`lang_${l}`)}</option>`)}
      </select>
      <sw-button size="sm" ?disabled=${this.busy || !dirty} data-member-mobile-save
        @click=${() => void this.saveStaff(m, { phone: dr.phone.trim() || null, lang: dr.lang })}>${tt('hdMobileSave')}</sw-button>
      ${m.mobile ? html`<sw-toggle label=${tt('hdMobileWhatsapp')} .checked=${m.notify_whatsapp !== false} ?disabled=${this.busy} data-member-whatsapp
        @change=${(e: CustomEvent<{ checked: boolean }>) => void this.saveStaff(m, { notify_whatsapp: e.detail.checked })}></sw-toggle>` : nothing}
    </div>`;
  }

  private add(d: AdminDepartment): void {
    const [kind, ...rest] = this.pick.split(':');
    if (!this.pick) return;
    void this.act(() => ticketsApi().putMember(d.id, kind as 'user' | 'group', rest.join(':'), this.newRole), () => { this.pick = ''; });
  }

  private membersOf(d: AdminDepartment): TemplateResult {
    const edit = d.can_edit_members;
    const options = [
      ...(this.directory?.users ?? []).filter((u) => !d.members.some((m) => m.kind === 'user' && m.id === u.id)).map((u) => ({ v: `user:${u.id}`, label: u.name })),
      ...(this.directory?.groups ?? []).filter((g) => !d.members.some((m) => m.kind === 'group' && m.id === g.id)).map((g) => ({ v: `group:${g.id}`, label: `${g.name} (${tt('depGroupTag')})` })),
    ];
    return html`<div class="people" data-handlers-members=${d.id}>
        ${d.members.length ? repeat(d.members, (m) => `${m.kind}:${m.id}`, (m) => html`<div class="person" data-member=${`${m.kind}:${m.id}`}>
          <span class="who">${bidi(m.name)}${m.kind === 'group' ? html` <span class="tag">${tt('depGroupTag')}</span>` : nothing}</span>
          <span class="seg" role="radiogroup" aria-label=${m.name}>${(['manager', 'member'] as const).map((r) => html`<button type="button" role="radio" aria-pressed=${String(m.role === r)}
            aria-checked=${String(m.role === r)} ?disabled=${this.busy || !edit || m.role === r} data-member-role=${r}
            @click=${() => void this.act(() => ticketsApi().putMember(d.id, m.kind, m.id, r))}>${r === 'manager' ? tt('hdRole_manager') : tt('hdRole_member')}</button>`)}</span>
          ${m.role === 'manager' && edit ? html`<sw-toggle label=${tt('depNotifyNew')} .checked=${m.notify_new} ?disabled=${this.busy} data-member-notify
            @change=${(e: CustomEvent<{ checked: boolean }>) => void this.act(() => ticketsApi().putMember(d.id, m.kind, m.id, m.role, e.detail.checked))}></sw-toggle>` : nothing}
          ${edit ? html`<button type="button" class="rm" data-member-remove ?disabled=${this.busy} @click=${() => void this.act(() => ticketsApi().deleteMember(d.id, m.kind, m.id))}>${tt('depRemove')}</button>` : nothing}
        </div>${m.kind === 'user' ? this.mobileOf(m) : nothing}`) : html`<span class="muted" data-members-empty>${tt('hdMembersEmpty')}</span>`}
      </div>
      ${edit ? html`<div class="add" data-members-add>
        <select class="in" data-member-pick aria-label=${tt('hdMemberPick')} @change=${(e: Event) => (this.pick = (e.target as HTMLSelectElement).value)}>
          <option value="" ?selected=${!this.pick}>${tt('hdMemberPick')}</option>
          ${options.map((o) => html`<option value=${o.v} ?selected=${this.pick === o.v}>${o.label}</option>`)}
        </select>
        <select class="in" data-member-new-role aria-label=${tt('depMembers')} @change=${(e: Event) => (this.newRole = (e.target as HTMLSelectElement).value as Role)}>
          <option value="member" ?selected=${this.newRole === 'member'}>${tt('hdRole_member')}</option>
          <option value="manager" ?selected=${this.newRole === 'manager'}>${tt('hdRole_manager')}</option>
        </select>
        <sw-button size="sm" variant="primary" icon="plus" ?disabled=${this.busy || !this.pick} data-member-add @click=${() => this.add(d)}>${tt('depMemberAdd')}</sw-button>
      </div>` : nothing}`;
  }

  render() {
    if (this.denied) return nothing;
    if (this.depts === null) return html`<sw-card heading=${tt('hdMembers')}><sw-state-panel state="loading"></sw-state-panel></sw-card>`;
    const d = this.depts.find((x) => x.id === this.selected) ?? null;
    return html`<sw-card heading=${tt('hdMembers')} data-card="handlers-members">
      ${this.depts.length ? html`<div class="depts" role="radiogroup" aria-label=${tt('hdDepartment')} data-members-depts>
          ${this.depts.map((x) => html`<button type="button" class="rc" role="radio" aria-pressed=${String(x.id === this.selected)} aria-checked=${String(x.id === this.selected)}
            data-members-dept=${x.id} @click=${() => { this.selected = x.id; this.pick = ''; }}>${bidi(x.name)} · ${x.members.length}</button>`)}</div>
        ${d ? this.membersOf(d) : nothing}`
        : html`<sw-state-panel state="empty" heading=${tt('hdNoDepartments')}></sw-state-panel>
          <div class="foot"><a href="#/system/tickets?tab=departments" data-to-departments>${tt('setTabDepartments')}</a></div>`}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-handlers-members': TicketsHandlersMembers;
  }
}
