import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-tabs';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-state-panel';
import { ApiError, describeError, patch } from '../api/client';
import { productSettings, invalidateSettings } from '../api/prefs';
import { can, canAnywhere, isApi } from '../api/session';
import { createBinding, revokeBinding } from '../api/access';
import { replaceRoute } from '../router';
import { applyTicketsHidden } from '../shell/nav';
import { settingsStyles } from '../styles/settings';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import {
  ticketsApi, type AdminDepartment, type DetailMode, type HoldersResponse, type NameEntries, type NewTicketMode, type SettingsDoc,
} from '../api/tickets';
import { DEFAULT_TICKET_NAMES, TICKET_GENDERS, TICKET_LANGS, nameProblem, onTicketNames, renderName, setTicketNames, type TicketLang, type TicketName } from '../tickets/naming';
import { tt, type TicketTextKey } from '../tickets/text';

type Tab = 'general' | 'departments' | 'permissions';
/** The unsaved inputs of one department card. */
interface DeptDraft { name?: string; reopen_days?: string; category?: string; member?: string; role?: 'manager' | 'member' }
const TABS: readonly Tab[] = ['general', 'departments', 'permissions'];
const PERMS = ['view', 'create', 'manage', 'external', 'all_departments', 'configure'] as const;
type Perm = (typeof PERMS)[number];
const SENSITIVE_PERMS: readonly Perm[] = ['external', 'all_departments', 'configure'];

/**
 * CR-038 Settings › the tickets module (`#/system/tickets?tab=general|departments|permissions`, section 14.2; the label is the module's
 * configured name, D33). Slice 1:
 *   כללי     the module switch (`tickets.enabled`, system.configure; off hides the area for everyone, the data is kept), the module's
 *            display name per language with its grammatical gender (D33, tickets.configure; validated here and on the server, applied
 *            live everywhere on save), and the display settings D18 / D22 (system.configure).
 *   מחלקות   departments with their categories, priorities and members (tickets.configure; a member edit also needs to manage the
 *            department or tickets.all_departments - the server's escalation rule). The SLA grid, templates and the department
 *            overrides are slice 2.
 *   הרשאות   who holds a ticket permission and through what (a role, a group, a personal grant), and the personal grants of D25 (one
 *            single-permission built-in role bound to one user through the ordinary binding route - rbac.assign decides).
 * While the module is off only the switch is offered (every other tickets route answers 404 by design).
 */
@customElement('system-tickets')
export class SystemTickets extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private tab: Tab = 'general';
  @state() private enabled: boolean | null = null;
  @state() private switching = false;
  @state() private doc: SettingsDoc | null = null;
  @state() private names: (NameEntries & { revision: number }) | null = null;
  @state() private draft: NameEntries | null = null;
  @state() private moreLangs = false;
  @state() private departments: AdminDepartment[] | null = null;
  @state() private directory: { users: { id: string; name: string }[]; groups: { id: string; name: string }[] } | null = null;
  @state() private holders: HoldersResponse | null = null;
  @state() private grantUser = '';
  @state() private busy = false;
  @state() private error = '';
  @state() private ok = '';
  @state() private newDept = { name: '', key: '' };
  @state() private deptDraft: Record<string, DeptDraft> = {};
  private okTimer = 0;
  private offNames: (() => void) | null = null;

  static styles = [settingsStyles, css`
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      max-inline-size: 980px;
      min-inline-size: 0;
    }
    sw-tabs {
      margin-block-end: var(--sw-s-3);
    }
    a {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    /* a stacked row: the label is a line, not a 220 px flex basis (which is a HEIGHT in a column) */
    .row.stack .lbl {
      flex: none;
    }
    .in {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .in[aria-invalid='true'] {
      border-color: var(--sw-danger);
    }
    .in.num {
      inline-size: 84px;
    }
    .names {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
      inline-size: 100%;
    }
    .names label {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-inline-size: 0;
    }
    .lang {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
      margin-block-start: var(--sw-s-2);
    }
    .preview {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .tag.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .tag.warn {
      background: var(--sw-stale-soft);
      color: var(--sw-warning-text);
    }
    .tag.acc {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .chipsrow {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .rm {
      border: 0;
      background: transparent;
      color: var(--sw-text-3);
      font: inherit;
      cursor: pointer;
      padding: 0 2px;
      min-block-size: 24px;
    }
    .rm:hover {
      color: var(--sw-danger);
    }
    .rc {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      padding-inline: 14px;
      border-radius: 999px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .rc[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .rc:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .people {
      display: flex;
      flex-direction: column;
    }
    .person {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .person:last-child {
      border-block-end: 0;
    }
    .person .who {
      font-weight: var(--sw-fw-semibold);
      min-inline-size: 140px;
    }
    .person .via {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .add {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    @media (max-width: 767px) {
      .names {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
      .names > :last-child {
        grid-column: 1 / -1;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.readTab();
    window.addEventListener('hashchange', this.onHash);
    this.offNames = onTicketNames(() => this.requestUpdate());
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHash);
    window.clearTimeout(this.okTimer);
    this.offNames?.();
  }

  private onHash = () => {
    if (window.location.hash.startsWith('#/system/tickets')) {
      const before = this.tab;
      this.readTab();
      if (before !== this.tab) void this.loadTab();
    }
  };

  private readTab(): void {
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('tab') as Tab | null;
    this.tab = q && TABS.includes(q) ? q : 'general';
  }

  private setTab(id: string): void {
    this.tab = TABS.includes(id as Tab) ? (id as Tab) : 'general';
    replaceRoute('/system/tickets', this.tab === 'general' ? undefined : new URLSearchParams({ tab: this.tab }));
    void this.loadTab();
  }

  private say(text: string): void {
    this.ok = text;
    this.error = '';
    window.clearTimeout(this.okTimer);
    this.okTimer = window.setTimeout(() => (this.ok = ''), 3000);
  }

  private fail(e: unknown): void {
    this.ok = '';
    this.error = describeError(e);
  }

  // ---------------------------------------------------------------- loading

  private async load(): Promise<void> {
    this.error = '';
    try {
      if (isApi()) {
        const ps = await productSettings(true);
        this.enabled = String((ps as unknown as Record<string, unknown>)['tickets.enabled'] ?? 'false') === 'true';
      } else {
        this.enabled = true;
      }
    } catch (e) {
      this.enabled = false;
      this.fail(e);
    }
    if (this.enabled) await this.loadTab();
  }

  private async loadTab(): Promise<void> {
    if (!this.enabled) return;
    try {
      if (this.tab === 'general') {
        const m = await ticketsApi().module();
        this.names = { ...m.name, revision: m.name_revision };
        if (!this.draft) this.draft = structuredClone(m.name);
        if (!isApi() || can('system.configure')) this.doc = await ticketsApi().settings();
      } else if (this.tab === 'departments') {
        const r = await ticketsApi().departments();
        this.departments = r.departments;
        if (!this.directory) this.directory = await ticketsApi().directory();
      } else {
        this.holders = await ticketsApi().holders();
        if (!this.directory) this.directory = await ticketsApi().directory();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.error = tt('setNoPermission');
      else this.fail(e);
    }
  }

  // ---------------------------------------------------------------- the switch, the name, the display

  private async setEnabled(on: boolean): Promise<void> {
    this.switching = true;
    this.error = '';
    try {
      if (isApi()) {
        await patch('settings', { 'tickets.enabled': String(on) });
        invalidateSettings();
      }
      this.enabled = on;
      applyTicketsHidden({ 'tickets.enabled': String(on) }); // the area appears / leaves the navigation at once
      this.say(tt('setSaved'));
      if (on) await this.loadTab();
    } catch (e) {
      this.fail(e);
    } finally {
      this.switching = false;
    }
  }

  private nameError(lang: TicketLang, field: 'one' | 'many'): string {
    const v = this.draft?.[lang][field] ?? '';
    const code = nameProblem(v);
    return code ? tt(`nameErr_${code}` as TicketTextKey) : '';
  }

  private setName(lang: TicketLang, patch: Partial<TicketName>): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, [lang]: { ...this.draft[lang], ...patch } };
  }

  private async saveName(): Promise<void> {
    const d = this.draft;
    if (!d || this.busy) return;
    for (const lang of TICKET_LANGS) if (this.nameError(lang, 'one') || this.nameError(lang, 'many')) return;
    this.busy = true;
    try {
      const doc = await ticketsApi().saveName(this.names?.revision ?? 0, d);
      this.names = doc;
      const { revision: _r, ...entries } = doc;
      this.draft = structuredClone(entries) as NameEntries;
      setTicketNames(entries); // D33: every screen, the navigation and the settings index follow at once
      this.say(tt('setSaved'));
    } catch (e) {
      this.fail(e);
      if (e instanceof ApiError && e.status === 409) {
        const m = await ticketsApi().module().catch(() => null);
        if (m) this.names = { ...m.name, revision: m.name_revision };
      }
    } finally {
      this.busy = false;
    }
  }

  private async saveUi(patch: Partial<SettingsDoc['ui']>): Promise<void> {
    if (!this.doc || this.busy) return;
    this.busy = true;
    try {
      this.doc = await ticketsApi().saveSettings(this.doc.revision, patch);
      this.say(tt('setSaved'));
    } catch (e) {
      this.fail(e);
      if (e instanceof ApiError && e.status === 409) this.doc = await ticketsApi().settings().catch(() => this.doc);
    } finally {
      this.busy = false;
    }
  }

  private nameRow(lang: TicketLang): TemplateResult {
    const e = this.draft?.[lang] ?? DEFAULT_TICKET_NAMES[lang];
    const editable = !isApi() || can('tickets.configure');
    const oneErr = this.nameError(lang, 'one');
    const manyErr = this.nameError(lang, 'many');
    const genders = TICKET_GENDERS[lang].filter(Boolean);
    return html`<div class="names" data-name-lang=${lang} dir=${lang === 'en' || lang === 'ru' ? 'ltr' : 'rtl'}>
      <label>${tt('setNameOne')}<input class="in" maxlength="30" data-name-one=${lang} aria-invalid=${String(!!oneErr)} ?disabled=${!editable} .value=${e.one} @input=${(ev: Event) => this.setName(lang, { one: (ev.target as HTMLInputElement).value })} />${oneErr ? html`<span class="field-error">${oneErr}</span>` : nothing}</label>
      <label>${tt('setNameMany')}<input class="in" maxlength="30" data-name-many=${lang} aria-invalid=${String(!!manyErr)} ?disabled=${!editable} .value=${e.many} @input=${(ev: Event) => this.setName(lang, { many: (ev.target as HTMLInputElement).value })} />${manyErr ? html`<span class="field-error">${manyErr}</span>` : nothing}</label>
      ${genders.length ? html`<label>${tt('setNameGender')}<span class="seg" role="radiogroup" aria-label=${tt('setNameGender')}>${genders.map((g) => html`<button type="button" role="radio" aria-pressed=${String(e.gender === g)} aria-checked=${String(e.gender === g)} data-name-gender=${`${lang}:${g}`} ?disabled=${!editable} @click=${() => this.setName(lang, { gender: g })}>${tt(`setGender_${g}` as TicketTextKey)}</button>`)}</span></label>` : html`<span></span>`}
    </div>`;
  }

  private generalTab(): TemplateResult {
    const mayConfigure = !isApi() || can('system.configure');
    const mayName = !isApi() || can('tickets.configure');
    const he = this.draft?.he ?? DEFAULT_TICKET_NAMES.he;
    const dirty = !!this.draft && !!this.names && TICKET_LANGS.some((l) => JSON.stringify(this.draft?.[l]) !== JSON.stringify(this.names?.[l]));
    const preview = ['{tickets}', '{ticket} {f:חדשה|m:חדש}', 'ה{tickets} {f:פתוחות|m:פתוחים}'].map((tpl) => renderName(tpl, { one: he.one || DEFAULT_TICKET_NAMES.he.one, many: he.many || DEFAULT_TICKET_NAMES.he.many, gender: he.gender }));
    return html`<div class="stack">
      <sw-card heading=${tt('setModuleCard')} data-card="module">
        <div class="row"><span class="lbl">${tt('setModuleSwitch')}<span class="muted">${tt('setModuleSwitchSub')}</span></span>
          <sw-toggle label=${tt('setModuleSwitch')} labelHidden .checked=${!!this.enabled} ?disabled=${!mayConfigure || this.switching} data-tickets-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => void this.setEnabled(e.detail.checked)}></sw-toggle></div>
        ${this.enabled && this.draft ? html`<div class="row stack" data-name-editor>
          <span class="lbl">${tt('setName')}<span class="muted">${tt('setNameSub')}</span></span>
          ${this.nameRow('he')}
          <div class="preview" data-name-preview aria-label=${tt('setNamePreview')}>${preview.map((p) => html`<span class="tag acc">${bidi(p)}</span>`)}</div>
          <div class="chipsrow"><button type="button" class="rc" aria-pressed=${String(this.moreLangs)} data-name-more @click=${() => (this.moreLangs = !this.moreLangs)}>${tt('setNameOtherLangs')}</button></div>
          ${this.moreLangs ? TICKET_LANGS.filter((l) => l !== 'he').map((l) => html`<div class="lang">${tt(`lang_${l}` as TicketTextKey)}</div>${this.nameRow(l)}`) : nothing}
          ${mayName ? html`<div class="foot"><sw-button variant="primary" size="sm" data-name-save ?disabled=${!dirty || this.busy} @click=${() => void this.saveName()}>${tt('save')}</sw-button>
            <sw-button size="sm" variant="ghost" data-name-default ?disabled=${this.busy} @click=${() => (this.draft = structuredClone(DEFAULT_TICKET_NAMES) as NameEntries)}>${tt('setNameDefault')}</sw-button></div>` : nothing}
        </div>` : nothing}
        ${!this.enabled ? html`<div class="row"><span class="muted" data-module-off>${tt('setModuleOff')}</span></div>` : nothing}
      </sw-card>
      ${this.enabled && this.doc && mayConfigure ? html`<sw-card heading=${tt('setDisplayCard')} data-card="display">
        <div class="row"><span class="lbl">${tt('setDetail')}<span class="muted">${tt('setDetailSub')}</span></span>
          <span class="seg" role="radiogroup" aria-label=${tt('setDetail')}>${(['drawer', 'fullscreen', 'drawer_fullscreen'] as DetailMode[]).map((v) => html`<button type="button" role="radio" aria-pressed=${String(this.doc?.ui.detail === v)} aria-checked=${String(this.doc?.ui.detail === v)} data-ui-detail=${v} ?disabled=${this.busy} @click=${() => void this.saveUi({ detail: v })}>${tt(`d_${v}` as TicketTextKey)}</button>`)}</span></div>
        <div class="row"><span class="lbl">${tt('setNewTicket')}<span class="muted">${tt('setNewTicketSub')}</span></span>
          <span class="seg" role="radiogroup" aria-label=${tt('setNewTicket')}>${(['sheet', 'dialog'] as NewTicketMode[]).map((v) => html`<button type="button" role="radio" aria-pressed=${String(this.doc?.ui.new_ticket === v)} aria-checked=${String(this.doc?.ui.new_ticket === v)} data-ui-new=${v} ?disabled=${this.busy} @click=${() => void this.saveUi({ new_ticket: v })}>${tt(`n_${v}` as TicketTextKey)}</button>`)}</span></div>
      </sw-card>` : nothing}
    </div>`;
  }

  // ---------------------------------------------------------------- departments

  private dd(id: string): DeptDraft {
    return this.deptDraft[id] ?? {};
  }

  private setDd(id: string, patch: DeptDraft): void {
    this.deptDraft = { ...this.deptDraft, [id]: { ...this.dd(id), ...patch } };
  }

  private replaceDept(d: AdminDepartment): void {
    this.departments = (this.departments ?? []).map((x) => (x.id === d.id ? d : x));
  }

  private async act(fn: () => Promise<AdminDepartment | void>, after?: () => void): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const d = await fn();
      if (d) this.replaceDept(d);
      after?.();
      this.say(tt('setSaved'));
    } catch (e) {
      this.fail(e);
      if (e instanceof ApiError && e.status === 409) void this.loadTab();
    } finally {
      this.busy = false;
    }
  }

  private async addDepartment(): Promise<void> {
    const name = this.newDept.name.trim();
    const key = this.newDept.key.trim().toLowerCase();
    if (!name || !/^[a-z][a-z0-9_-]{1,31}$/.test(key) || this.busy) {
      this.error = tt('depKeySub');
      return;
    }
    this.busy = true;
    try {
      const d = await ticketsApi().createDepartment({ name, key });
      this.departments = [...(this.departments ?? []), d];
      this.newDept = { name: '', key: '' };
      this.say(tt('setSaved'));
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
    }
  }

  private async removeDepartment(d: AdminDepartment): Promise<void> {
    if (this.busy || !window.confirm(`${tt('deleteConfirm')} ${d.name}`)) return;
    this.busy = true;
    try {
      await ticketsApi().deleteDepartment(d.id);
      this.departments = (this.departments ?? []).filter((x) => x.id !== d.id);
      this.say(tt('setSaved'));
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
    }
  }

  private deptCard(d: AdminDepartment): TemplateResult {
    const dr = this.dd(d.id);
    const name = dr.name ?? d.name;
    const days = dr.reopen_days ?? String(d.reopen_days);
    const memberOptions = [
      ...(this.directory?.users ?? []).filter((u) => !d.members.some((m) => m.kind === 'user' && m.id === u.id)).map((u) => ({ v: `user:${u.id}`, label: u.name })),
      ...(this.directory?.groups ?? []).filter((g) => !d.members.some((m) => m.kind === 'group' && m.id === g.id)).map((g) => ({ v: `group:${g.id}`, label: `${g.name} (${tt('depGroupTag')})` })),
    ];
    return html`<sw-card heading=${d.name} subheading=${`${d.key} · ${tt('depOpenTickets', { n: d.open_tickets })}`} data-dept=${d.id}>
      <div class="row"><span class="lbl">${tt('depName')}</span>
        <span class="end"><input class="in" maxlength="40" data-dept-name .value=${name} @input=${(e: Event) => this.setDd(d.id, { name: (e.target as HTMLInputElement).value })} />
          <sw-button size="sm" ?disabled=${this.busy || !name.trim() || name.trim() === d.name} data-dept-rename @click=${() => void this.act(() => ticketsApi().patchDepartment(d.id, { name: name.trim(), revision: d.revision }), () => this.setDd(d.id, { name: undefined }))}>${tt('save')}</sw-button></span></div>
      <div class="row"><span class="lbl">${tt('depActive')}</span>
        <sw-toggle label=${tt('depActive')} labelHidden .checked=${d.active} ?disabled=${this.busy} data-dept-active @change=${(e: CustomEvent<{ checked: boolean }>) => void this.act(() => ticketsApi().patchDepartment(d.id, { active: e.detail.checked, revision: d.revision }))}></sw-toggle></div>
      <div class="row"><span class="lbl">${tt('depOpenToAll')}<span class="muted">${tt('depOpenToAllSub')}</span></span>
        <sw-toggle label=${tt('depOpenToAll')} labelHidden .checked=${d.open_to_all} ?disabled=${this.busy} data-dept-open @change=${(e: CustomEvent<{ checked: boolean }>) => void this.act(() => ticketsApi().patchDepartment(d.id, { open_to_all: e.detail.checked, revision: d.revision }))}></sw-toggle></div>
      <div class="row"><span class="lbl">${tt('depReopenDays')}</span>
        <span class="end"><input class="in num" type="number" min="1" max="90" data-dept-reopen .value=${days} @input=${(e: Event) => this.setDd(d.id, { reopen_days: (e.target as HTMLInputElement).value })} />
          <sw-button size="sm" ?disabled=${this.busy || Number(days) === d.reopen_days || !(Number(days) >= 1 && Number(days) <= 90)} @click=${() => void this.act(() => ticketsApi().patchDepartment(d.id, { reopen_days: Number(days), revision: d.revision }), () => this.setDd(d.id, { reopen_days: undefined }))}>${tt('save')}</sw-button></span></div>
      <div class="row stack"><span class="lbl">${tt('depCategories')}</span>
        <div class="chipsrow" data-dept-categories>${d.categories.filter((c) => c.active).length ? d.categories.filter((c) => c.active).map((c) => html`<span class="tag">${bidi(c.name)}<button type="button" class="rm" aria-label=${`${tt('depRemove')} ${c.name}`} data-cat-remove=${c.id} ?disabled=${this.busy} @click=${() => void this.act(() => ticketsApi().deleteCategory(c.id))}>×</button></span>`) : html`<span class="muted">${tt('depCatNone')}</span>`}</div>
        <div class="add"><input class="in" maxlength="60" data-cat-new placeholder=${tt('depCatAdd')} .value=${dr.category ?? ''} @input=${(e: Event) => this.setDd(d.id, { category: (e.target as HTMLInputElement).value })} />
          <sw-button size="sm" icon="plus" ?disabled=${this.busy || !(dr.category ?? '').trim()} data-cat-add @click=${() => void this.act(() => ticketsApi().createCategory(d.id, (dr.category ?? '').trim()), () => this.setDd(d.id, { category: '' }))}>${tt('depMemberAdd')}</sw-button></div></div>
      <div class="row stack"><span class="lbl">${tt('depPriorities')}</span>
        <div class="chipsrow" data-dept-priorities>${d.priorities.filter((p) => p.active).map((p) => p.is_default
          ? html`<span class="tag ok" data-prio-default=${p.key}>${bidi(p.name)} · ${tt('depDefault')}</span>`
          : html`<button type="button" class="rc" title=${tt('depMakeDefault')} data-prio-make-default=${p.key} ?disabled=${this.busy} @click=${() => void this.act(() => ticketsApi().patchPriority(p.id, { is_default: true }))}>${bidi(p.name)}</button>`)}</div></div>
      <div class="row stack"><span class="lbl">${tt('depMembers')}${!d.can_edit_members ? html`<span class="muted">${tt('depMembersLocked')}</span>` : nothing}</span>
        <div class="people" data-dept-members>${d.members.length ? repeat(d.members, (m) => `${m.kind}:${m.id}`, (m) => html`<div class="person" data-member=${`${m.kind}:${m.id}`}>
          <span class="who">${bidi(m.name)}${m.kind === 'group' ? html` <span class="tag">${tt('depGroupTag')}</span>` : nothing}</span>
          <span class="seg" role="radiogroup" aria-label=${m.name}>${(['manager', 'member'] as const).map((r) => html`<button type="button" role="radio" aria-pressed=${String(m.role === r)} aria-checked=${String(m.role === r)} ?disabled=${this.busy || !d.can_edit_members || m.role === r} data-member-role=${r} @click=${() => void this.act(() => ticketsApi().putMember(d.id, m.kind, m.id, r))}>${r === 'manager' ? tt('depManager') : tt('depMember')}</button>`)}</span>
          ${d.can_edit_members ? html`<button type="button" class="rm" data-member-remove ?disabled=${this.busy} @click=${() => void this.act(() => ticketsApi().deleteMember(d.id, m.kind, m.id))}>${tt('depRemove')}</button>` : nothing}
        </div>`) : html`<span class="muted">${tt('depNoMembers')}</span>`}</div>
        ${d.can_edit_members ? html`<div class="add">
          <select class="in" data-member-pick aria-label=${tt('depMemberPick')} @change=${(e: Event) => this.setDd(d.id, { member: (e.target as HTMLSelectElement).value })}>
            <option value="" ?selected=${!dr.member}>${tt('depMemberPick')}</option>
            ${memberOptions.map((o) => html`<option value=${o.v} ?selected=${dr.member === o.v}>${o.label}</option>`)}
          </select>
          <select class="in" data-member-new-role aria-label=${tt('depMembers')} @change=${(e: Event) => this.setDd(d.id, { role: (e.target as HTMLSelectElement).value as 'manager' | 'member' })}>
            <option value="member" ?selected=${(dr.role ?? 'member') === 'member'}>${tt('depMember')}</option>
            <option value="manager" ?selected=${dr.role === 'manager'}>${tt('depManager')}</option>
          </select>
          <sw-button size="sm" icon="plus" ?disabled=${this.busy || !dr.member} data-member-add @click=${() => { const [kind, ...rest] = (dr.member ?? '').split(':'); void this.act(() => ticketsApi().putMember(d.id, kind as 'user' | 'group', rest.join(':'), dr.role ?? 'member'), () => this.setDd(d.id, { member: '' })); }}>${tt('depMemberAdd')}</sw-button>
        </div>` : nothing}</div>
      ${d.open_tickets === 0 ? html`<div class="row"><span class="lbl"></span><sw-button size="sm" variant="danger" data-dept-delete ?disabled=${this.busy} @click=${() => void this.removeDepartment(d)}>${tt('depDelete')}</sw-button></div>` : nothing}
    </sw-card>`;
  }

  private departmentsTab(): TemplateResult {
    if (!this.departments) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    return html`<div class="stack">
      <sw-card heading=${tt('depAdd')} data-card="dept-new">
        <div class="add">
          <input class="in" maxlength="40" data-dept-new-name placeholder=${tt('depName')} .value=${this.newDept.name} @input=${(e: Event) => (this.newDept = { ...this.newDept, name: (e.target as HTMLInputElement).value })} />
          <input class="in" maxlength="32" dir="ltr" data-dept-new-key placeholder=${tt('depKey')} title=${tt('depKeySub')} .value=${this.newDept.key} @input=${(e: Event) => (this.newDept = { ...this.newDept, key: (e.target as HTMLInputElement).value })} />
          <sw-button size="sm" variant="primary" icon="plus" data-dept-add ?disabled=${this.busy || !this.newDept.name.trim() || !this.newDept.key.trim()} @click=${() => void this.addDepartment()}>${tt('depMemberAdd')}</sw-button>
        </div>
      </sw-card>
      ${this.departments.length ? repeat(this.departments, (d) => d.id, (d) => this.deptCard(d)) : html`<sw-state-panel state="empty" heading=${tt('depNone')}></sw-state-panel>`}
    </div>`;
  }

  // ---------------------------------------------------------------- permissions (section 8.2)

  private async toggleGrant(perm: Perm, on: boolean): Promise<void> {
    const uid = this.grantUser;
    if (!uid || this.busy) return;
    this.busy = true;
    try {
      const role = `tickets_${perm}`;
      if (on) await createBinding({ subject_kind: 'user', subject_id: uid, role_id: role, scope_type: 'installation', scope_id: '*' });
      else {
        const grant = this.holders?.users.find((u) => u.id === uid)?.grants.find((g) => g.via === 'grant' && g.role_id === role);
        if (grant) await revokeBinding(grant.binding_id);
      }
      this.holders = await ticketsApi().holders();
      this.say(tt('setSaved'));
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
    }
  }

  private permissionsTab(): TemplateResult {
    if (!this.holders) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const mayAssign = !isApi() || canAnywhere('rbac.assign');
    const label = (p: string) => tt(`p_${p.replace(/^tickets\./, '')}` as TicketTextKey);
    const granted = (uid: string, perm: Perm) => this.holders?.users.find((u) => u.id === uid)?.grants.some((g) => g.via === 'grant' && g.role_id === `tickets_${perm}`) ?? false;
    const viaText = (g: HoldersResponse['users'][number]['grants'][number]) => g.via === 'grant' ? tt('via_grant') : g.via === 'group' ? tt('via_group', { group: g.group_name ?? '' }) : tt('via_role', { role: g.role_name });
    return html`<div class="stack">
      <sw-card heading=${tt('permHolders')} data-card="holders">
        ${this.holders.users.length ? html`<div class="people">${repeat(this.holders.users, (u) => u.id, (u) => html`<div class="person" data-holder=${u.id}>
          <span class="who">${bidi(u.name)}${u.active ? nothing : html` <span class="tag warn">${tt('permInactive')}</span>`}</span>
          ${u.grants.map((g) => html`<span class="chipsrow">${g.permissions.map((p) => html`<span class=${`tag ${SENSITIVE_PERMS.includes(p.replace(/^tickets\./, '') as Perm) ? 'warn' : ''}`}>${label(p)}</span>`)}<span class="via">${viaText(g)}${g.scope_type !== 'installation' ? ` · ${tt('permScope', { scope: g.scope_name })}` : ''}</span></span>`)}
        </div>`)}</div>` : html`<span class="muted">${tt('permNone')}</span>`}
        <div class="row"><span class="lbl"></span><a href="#/system/access" data-to-users>${tt('permToUsers')}</a></div>
      </sw-card>
      <sw-card heading=${tt('permGrantCard')} data-card="grant">
        ${mayAssign ? html`
          <div class="row"><span class="lbl">${tt('permGrantUser')}</span>
            <select class="in" data-grant-user aria-label=${tt('permGrantPick')} @change=${(e: Event) => (this.grantUser = (e.target as HTMLSelectElement).value)}>
              <option value="" ?selected=${!this.grantUser}>${tt('permGrantPick')}</option>
              ${(this.directory?.users ?? []).map((u) => html`<option value=${u.id} ?selected=${u.id === this.grantUser}>${u.name}</option>`)}
            </select></div>
          ${this.grantUser ? html`<div class="chipsrow" data-grant-perms>${PERMS.map((p) => {
            const on = granted(this.grantUser, p);
            return html`<button type="button" class="rc" aria-pressed=${String(on)} data-grant=${p} ?disabled=${this.busy} @click=${() => void this.toggleGrant(p, !on)}>${on ? '✓ ' : '+ '}${tt(`p_${p}` as TicketTextKey)}${SENSITIVE_PERMS.includes(p) ? ` · ${tt('sensitive')}` : ''}</button>`;
          })}</div>` : nothing}`
          : html`<div class="row"><span class="muted">${tt('permGrantNoAssign')}</span><a href="#/system/access">${tt('permToUsers')}</a></div>`}
      </sw-card>
    </div>`;
  }

  // ---------------------------------------------------------------- page

  render() {
    const heading = tt('area');
    if (this.enabled === null) return html`<sw-page crumbs="הגדרות" heading=${heading}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const tabs = this.enabled ? html`<sw-tabs variant="underline" data-tickets-settings-tabs .items=${[
      { id: 'general', label: tt('setTabGeneral') }, { id: 'departments', label: tt('setTabDepartments') }, { id: 'permissions', label: tt('setTabPermissions') },
    ]} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => this.setTab(e.detail.id)}></sw-tabs>` : nothing;
    const body = !this.enabled || this.tab === 'general' ? this.generalTab() : this.tab === 'departments' ? this.departmentsTab() : this.permissionsTab();
    return html`<sw-page crumbs="הגדרות" heading=${heading} subheading=${tt('setSub')} data-tickets-settings data-tab=${this.tab}>
      ${tabs}
      ${this.error ? html`<div class="msg err" role="alert" data-tickets-settings-error>${this.error}</div>` : nothing}
      ${this.ok ? html`<div class="msg ok" role="status" data-tickets-settings-ok>${this.ok}</div>` : nothing}
      ${body}
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-tickets': SystemTickets;
  }
}
