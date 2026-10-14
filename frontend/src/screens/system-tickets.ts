import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-tabs';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-state-panel';
import '../tickets/settings-dept';
import '../tickets/public-settings';
import '../tickets/settings-channel'; // slice 5b: ערוץ הודעות
import '../tickets/settings-message-templates'; // slice 5b: תבניות הודעה (D26)
import '../tickets/settings-costs'; // slice 9b: costs (11A.14)
import { ct } from '../tickets/cost-text';
import { mtt } from '../tickets/messages-text';
import { ApiError, describeError, patch } from '../api/client';
import { productSettings, invalidateSettings } from '../api/prefs';
import { can, canAnywhere, isApi } from '../api/session';
import { createBinding, revokeBinding } from '../api/access';
import { loadTree } from '../api/catalog';
import { replaceRoute } from '../router';
import { applyTicketsHidden, TICKETS_HANDLERS_HREF } from '../shell/nav';
import { settingsStyles } from '../styles/settings';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import {
  ticketsApi, type AdminDepartment, type DeletedDepartment, type DetailMode, type HoldersResponse, type InstallationDefaults, type NameEntries, type NewTicketMode, type SettingsDoc,
  type SettingsPatch,
} from '../api/tickets';
import { DEFAULT_TICKET_NAMES, TICKET_GENDERS, TICKET_LANGS, moduleDefault, nameProblem, onTicketNames, renderName, setTicketNames, type TicketLang, type TicketName } from '../tickets/naming';
import { intIn, windowProblem } from '../tickets/durations';
import { ticketSettingsCss } from '../tickets/settings-styles';
import { tt, type TicketTextKey } from '../tickets/text';
import { ticketPermLabel } from '../tickets/perm-label';
import '../tickets/board-settings'; // CR-038 slice 6: the D19-D21 rows of the display card
import type { BoardSettingsDoc } from '../api/tickets-board';
import { dt } from '../tickets/device-text'; // CR-038 slice 3: the D17 row
import { setLongPressMode } from '../tickets/device-entry';

type Tab = 'general' | 'departments' | 'channel' | 'messages' | 'costs' | 'permissions';
const TABS: readonly Tab[] = ['general', 'departments', 'channel', 'messages', 'costs', 'permissions'];
const PERMS = ['view', 'create', 'manage', 'external', 'all_departments', 'configure'] as const;
type Perm = (typeof PERMS)[number];
const SENSITIVE_PERMS: readonly Perm[] = ['external', 'all_departments', 'configure'];
type Grant = HoldersResponse['users'][number]['grants'][number];
interface ScopeOption { type: string; id: string; label: string }

/**
 * CR-038 Settings › the tickets module (`#/system/tickets?tab=general|departments|permissions`, section 14.2; the label is the module's
 * configured name, D33).
 *   כללי     the module switch (`tickets.enabled`, system.configure), the module's display name (D33, tickets.configure), the display
 *            settings D18 / D22 and - slice 2 - the installation values the departments fall back to: link lifetime (D5), vendor send
 *            hours (D4) and urgent as critical (D28) (system.configure).
 *   מחלקות   slice 2: the department list and the editor of the chosen one (tickets/settings-dept.ts: details, categories, members,
 *            priorities, the department rules and overrides, the SLA grid, opening templates; tickets.configure - member edits also need
 *            to manage the department or tickets.all_departments, the server's escalation rule).
 *   ערוץ הודעות    slice 5b: the WhatsApp master switch, buttons, the reply window and the e-mail fallback (system.configure;
 *                  tickets/settings-channel.ts); the ticket uses' accounts are shown read-only (Settings › the message channel owns them).
 *   תבניות הודעה   slice 5b: message templates per purpose x language x department with a preview (D26, tickets.configure;
 *                  tickets/settings-message-templates.ts).
 *   הרשאות   "who may": every role with the ticket permissions it carries; the holders by person or by permission (a role, a group, a
 *            personal grant); and the personal grants of D25 (one single-permission built-in role bound to one user through the ordinary
 *            binding route, at a chosen scope and with an optional end date - rbac.assign and the delegation rules decide).
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
  @state() private deletedDepts: DeletedDepartment[] = [];
  @state() private installation: InstallationDefaults | null = null;
  @state() private selected = '';
  @state() private directory: { users: { id: string; name: string }[]; groups: { id: string; name: string }[] } | null = null;
  @state() private holders: HoldersResponse | null = null;
  @state() private holdersBy: 'person' | 'perm' = 'person';
  @state() private permsFailed = false;
  @state() private grantUser = '';
  @state() private grantScope = 'installation:*';
  @state() private grantUntil = '';
  @state() private scopes: ScopeOption[] | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private ok = '';
  @state() private newDept = { name: '', key: '' };
  @state() private instDraft: { sliding?: string; cap?: string; grace?: string; from?: string; to?: string } = {};
  private okTimer = 0;
  private offNames: (() => void) | null = null;

  static styles = [settingsStyles, ticketSettingsCss, css`
    sw-tabs {
      margin-block-end: var(--sw-s-3);
    }
    details[data-dept-deleted] summary {
      cursor: pointer;
      min-block-size: 36px;
      display: flex;
      align-items: center;
      font-weight: var(--sw-fw-medium);
    }
    .btnlink {
      display: inline-flex;
      align-items: center;
      flex: none;
      min-block-size: 36px;
      padding-inline: 14px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-accent);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
    }
    .btnlink:hover {
      border-color: var(--sw-accent);
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
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('tab');
    // owner request 2026-10-14: "ספקים ואנשי קשר" left Settings for the area's "מטפלים וספקים" page - the old address still lands there
    if (q === 'contacts') {
      queueMicrotask(() => window.location.replace(`${TICKETS_HANDLERS_HREF}?seg=vendors`));
      return;
    }
    this.tab = q && TABS.includes(q as Tab) ? (q as Tab) : 'general';
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
    this.error = typeof e === 'string' ? e : describeError(e);
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

  private async loadDepartments(): Promise<void> {
    const r = await ticketsApi().departments();
    this.departments = r.departments;
    this.deletedDepts = r.deleted ?? [];
    this.installation = r.installation ?? null;
    if (!r.departments.some((d) => d.id === this.selected)) this.selected = r.departments[0]?.id ?? '';
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
        await this.loadDepartments();
        if (!this.directory) this.directory = await ticketsApi().directory();
      } else if (this.tab === 'channel' || this.tab === 'messages' || this.tab === 'costs') {
        // slice 5b: the components load their own data (tickets/settings-channel.ts, tickets/settings-message-templates.ts)
      } else {
        this.permsFailed = false;
        this.holders = await ticketsApi().holders();
        if (!this.directory) this.directory = await ticketsApi().directory();
        if (!this.scopes) void this.loadScopes();
      }
    } catch (e) {
      if (this.tab === 'permissions') {
        this.permsFailed = true; // the tab shows an error state with "try again" instead of loading forever
        console.error('tickets permissions tab: load failed', e instanceof ApiError ? `api ${e.status}` : e instanceof Error ? e.name : typeof e);
      }
      if (e instanceof ApiError && e.status === 403) this.error = tt('setNoPermission');
      else this.fail(e);
    }
  }

  private async loadScopes(): Promise<void> {
    const out: ScopeOption[] = [{ type: 'installation', id: '*', label: tt('permScopeAll') }];
    try {
      const tree = await loadTree();
      for (const s of tree.sites) {
        out.push({ type: 'site', id: s.id, label: s.name });
        for (const b of s.buildings ?? []) {
          out.push({ type: 'building', id: b.id, label: `${s.name} › ${b.name}` });
          for (const f of b.floors ?? []) out.push({ type: 'floor', id: f.id, label: `${s.name} › ${b.name} › ${f.name}` });
        }
      }
    } catch {
      // the installation scope alone (the tree is optional here)
    }
    this.scopes = out;
  }

  // ---------------------------------------------------------------- the switch, the name, the display, the installation values

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

  private nameError(lang: TicketLang, field: 'one' | 'many' | 'module'): string {
    const v = this.draft?.[lang][field] ?? '';
    if (field === 'module' && !v.trim()) return ''; // optional: empty = derived from the item names
    const code = nameProblem(v);
    return code ? tt(`nameErr_${code}` as TicketTextKey) : '';
  }

  private setName(lang: TicketLang, p: Partial<TicketName>): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, [lang]: { ...this.draft[lang], ...p } };
  }

  private async saveName(): Promise<void> {
    const d = this.draft;
    if (!d || this.busy) return;
    for (const lang of TICKET_LANGS) if (this.nameError(lang, 'one') || this.nameError(lang, 'many') || this.nameError(lang, 'module')) return;
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

  private async saveDoc(p: SettingsPatch, after?: () => void): Promise<void> {
    if (!this.doc || this.busy) return;
    this.busy = true;
    try {
      this.doc = await ticketsApi().saveInstallation(this.doc.revision, p);
      after?.();
      this.say(tt('setSaved'));
    } catch (e) {
      this.fail(e);
      if (e instanceof ApiError && e.status === 409) this.doc = await ticketsApi().settings().catch(() => this.doc);
    } finally {
      this.busy = false;
    }
  }

  /** CR-038 slice 3, D17: what a long press on a device opens - the device window (default) or the short opaque menu. */
  private longPressRow(): TemplateResult {
    const cur = this.doc?.device_long_press ?? 'sheet';
    return html`<div class="row" data-long-press><span class="lbl">${dt('setLongPress')}<span class="muted">${dt('setLongPressSub')}</span></span>
      <span class="seg" role="radiogroup" aria-label=${dt('setLongPress')}>${(['sheet', 'menu'] as const).map((v) => html`<button type="button" role="radio" aria-pressed=${String(cur === v)} aria-checked=${String(cur === v)} data-long-press-mode=${v} ?disabled=${this.busy} @click=${() => void this.saveLongPress(v)}>${dt(`lp_${v}`)}</button>`)}</span></div>`;
  }

  private async saveLongPress(mode: 'sheet' | 'menu'): Promise<void> {
    if (!this.doc || this.doc.device_long_press === mode) return;
    // this tab follows at once; everyone else with their next /me
    await this.saveDoc({ device_long_press: mode }, () => setLongPressMode(this.doc?.device_long_press ?? mode));
  }


  private nameRow(lang: TicketLang): TemplateResult {
    const e = this.draft?.[lang] ?? DEFAULT_TICKET_NAMES[lang];
    const editable = !isApi() || can('tickets.configure');
    const oneErr = this.nameError(lang, 'one');
    const manyErr = this.nameError(lang, 'many');
    const moduleErr = this.nameError(lang, 'module');
    const genders = TICKET_GENDERS[lang].filter(Boolean);
    return html`<div class="names" data-name-lang=${lang} dir=${lang === 'en' || lang === 'ru' ? 'ltr' : 'rtl'}>
      <label>${tt('setNameModule')}<input class="in" maxlength="30" data-name-module=${lang} aria-invalid=${String(!!moduleErr)} ?disabled=${!editable} .value=${e.module ?? ''} @input=${(ev: Event) => this.setName(lang, { module: (ev.target as HTMLInputElement).value })} />${moduleErr ? html`<span class="field-error">${moduleErr}</span>` : nothing}</label>
      <label>${tt('setNameOne')}<input class="in" maxlength="30" data-name-one=${lang} aria-invalid=${String(!!oneErr)} ?disabled=${!editable} .value=${e.one} @input=${(ev: Event) => this.setName(lang, { one: (ev.target as HTMLInputElement).value })} />${oneErr ? html`<span class="field-error">${oneErr}</span>` : nothing}</label>
      <label>${tt('setNameMany')}<input class="in" maxlength="30" data-name-many=${lang} aria-invalid=${String(!!manyErr)} ?disabled=${!editable} .value=${e.many} @input=${(ev: Event) => this.setName(lang, { many: (ev.target as HTMLInputElement).value })} />${manyErr ? html`<span class="field-error">${manyErr}</span>` : nothing}</label>
      ${genders.length ? html`<label>${tt('setNameGender')}<span class="seg" role="radiogroup" aria-label=${tt('setNameGender')}>${genders.map((g) => html`<button type="button" role="radio" aria-pressed=${String(e.gender === g)} aria-checked=${String(e.gender === g)} data-name-gender=${`${lang}:${g}`} ?disabled=${!editable} @click=${() => this.setName(lang, { gender: g })}>${tt(`setGender_${g}` as TicketTextKey)}</button>`)}</span></label>` : html`<span></span>`}
    </div>`;
  }

  /** slice 2: the link lifetime card (D5) - the values every department without its own override uses. */
  private linksCard(doc: SettingsDoc): TemplateResult {
    const links = doc.links ?? { sliding_days: 14, cap_days: 90, grace_hours: 24 };
    const d = this.instDraft;
    const raw = { sliding: d.sliding ?? String(links.sliding_days), cap: d.cap ?? String(links.cap_days), grace: d.grace ?? String(links.grace_hours) };
    const sliding = intIn(raw.sliding, 1, 90);
    const cap = intIn(raw.cap, 7, 365);
    const grace = intIn(raw.grace, 0, 168);
    const err = Number.isNaN(sliding) || Number.isNaN(cap) || Number.isNaN(grace) ? 'range' : cap < sliding ? 'below_sliding' : null;
    const dirty = sliding !== links.sliding_days || cap !== links.cap_days || grace !== links.grace_hours;
    const row = (key: 'sliding' | 'cap' | 'grace', label: TicketTextKey, sub: TicketTextKey, unit: TicketTextKey, lo: number, hi: number, bad: boolean) => html`
      <div class="row"><span class="lbl">${tt(label)}<span class="muted">${tt(sub)}</span></span>
        <span class="unit"><input class="in num" type="number" min=${lo} max=${hi} data-inst-link=${key} aria-label=${tt(label)} aria-invalid=${String(bad)} .value=${raw[key]}
          @input=${(e: Event) => (this.instDraft = { ...this.instDraft, [key]: (e.target as HTMLInputElement).value })} /><span class="muted">${tt(unit)}</span></span></div>`;
    return html`<sw-card heading=${tt('setLinksCard')} data-card="links">
      ${row('sliding', 'setLinksSliding', 'setLinksSlidingSub', 'unit_d', 1, 90, Number.isNaN(sliding) || err === 'below_sliding')}
      ${row('cap', 'setLinksCap', 'setLinksCapSub', 'unit_d', 7, 365, Number.isNaN(cap) || err === 'below_sliding')}
      ${row('grace', 'setLinksGrace', 'setLinksGraceSub', 'unit_h', 0, 168, Number.isNaN(grace))}
      <div class="foot"><sw-button variant="primary" size="sm" data-inst-links-save ?disabled=${!dirty || !!err || this.busy}
        @click=${() => void this.saveDoc({ links: { sliding_days: sliding, cap_days: cap, grace_hours: grace } }, () => (this.instDraft = { ...this.instDraft, sliding: undefined, cap: undefined, grace: undefined }))}>${tt('save')}</sw-button>
        ${err ? html`<span class="field-error">${tt(`err_${err}` as TicketTextKey)}</span>` : nothing}</div>
    </sw-card>`;
  }

  /** slice 2: vendor send hours (D4) and urgent as critical (D28). */
  private hoursCard(doc: SettingsDoc): TemplateResult {
    const hours = doc.send_hours ?? { from: '07:00', to: '21:00' };
    const from = this.instDraft.from ?? hours.from;
    const to = this.instDraft.to ?? hours.to;
    const err = windowProblem(from, to);
    const dirty = from !== hours.from || to !== hours.to;
    return html`<sw-card heading=${tt('setHoursCard')} data-card="hours">
      <div class="row"><span class="lbl">${tt('setHoursRow')}<span class="muted">${tt('setHoursRowSub')}</span></span>
        <span class="end"><input class="in time" type="time" data-inst-hours="from" aria-label=${tt('setHoursRow')} aria-invalid=${String(!!err)} .value=${from} @input=${(e: Event) => (this.instDraft = { ...this.instDraft, from: (e.target as HTMLInputElement).value })} />
          <span class="muted">${tt('hoursTo')}</span>
          <input class="in time" type="time" data-inst-hours="to" aria-label=${`${tt('setHoursRow')} · ${tt('hoursTo')}`} aria-invalid=${String(!!err)} .value=${to} @input=${(e: Event) => (this.instDraft = { ...this.instDraft, to: (e.target as HTMLInputElement).value })} />
          <sw-button size="sm" variant="primary" data-inst-hours-save ?disabled=${!dirty || !!err || this.busy}
            @click=${() => void this.saveDoc({ send_hours: { from, to } }, () => (this.instDraft = { ...this.instDraft, from: undefined, to: undefined }))}>${tt('save')}</sw-button></span></div>
      ${err ? html`<div class="row"><span class="field-error">${tt(`err_${err}` as TicketTextKey)}</span></div>` : nothing}
      <div class="row"><span class="lbl">${tt('setUrgent')}<span class="muted">${tt('setUrgentSub')}</span></span>
        <sw-toggle label=${tt('setUrgent')} labelHidden .checked=${doc.urgent_is_critical ?? true} ?disabled=${this.busy} data-inst-urgent
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.saveDoc({ urgent_is_critical: e.detail.checked })}></sw-toggle></div>
    </sw-card>`;
  }

  private generalTab(): TemplateResult {
    const mayConfigure = !isApi() || can('system.configure');
    const mayName = !isApi() || can('tickets.configure');
    // owner 2026-10-14: the directory left Settings for the area's "מטפלים וספקים" page - a link card here (its readers only)
    const mayHandlers = !isApi() || can('tickets.configure') || canAnywhere('tickets.manage');
    const he = this.draft?.he ?? DEFAULT_TICKET_NAMES.he;
    const dirty = !!this.draft && !!this.names && TICKET_LANGS.some((l) => JSON.stringify(this.draft?.[l]) !== JSON.stringify(this.names?.[l]));
    const heOne = he.one || DEFAULT_TICKET_NAMES.he.one;
    const heMany = he.many || DEFAULT_TICKET_NAMES.he.many;
    const preview = ['{module}', '{ticket} {f:חדשה|m:חדש}', '{the_tickets} {f:פתוחות|m:פתוחים}'].map((tpl) => renderName(tpl, { one: heOne, many: heMany, gender: he.gender, module: he.module?.trim() || moduleDefault('he', heOne, heMany) }));
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
      ${this.enabled && mayHandlers ? html`<sw-card heading=${tt('setHandlersCard')} data-card="handlers-link">
        <div class="row"><span class="lbl">${tt('hdSeg_handlers')} · ${tt('hdSeg_vendors')} · ${tt('hdSeg_contacts')}</span>
          <a class="btnlink" href=${TICKETS_HANDLERS_HREF} data-to-handlers>${tt('setHandlersOpen')}</a></div>
      </sw-card>` : nothing}
      ${this.enabled && this.doc && mayConfigure ? html`<sw-card heading=${tt('setDisplayCard')} data-card="display">
        <div class="row"><span class="lbl">${tt('setDetail')}<span class="muted">${tt('setDetailSub')}</span></span>
          <span class="seg" role="radiogroup" aria-label=${tt('setDetail')}>${(['drawer', 'fullscreen', 'drawer_fullscreen'] as DetailMode[]).map((v) => html`<button type="button" role="radio" aria-pressed=${String(this.doc?.ui.detail === v)} aria-checked=${String(this.doc?.ui.detail === v)} data-ui-detail=${v} ?disabled=${this.busy} @click=${() => void this.saveDoc({ ui: { detail: v } })}>${tt(`d_${v}` as TicketTextKey)}</button>`)}</span></div>
        <div class="row"><span class="lbl">${tt('setNewTicket')}<span class="muted">${tt('setNewTicketSub')}</span></span>
          <span class="seg" role="radiogroup" aria-label=${tt('setNewTicket')}>${(['sheet', 'dialog'] as NewTicketMode[]).map((v) => html`<button type="button" role="radio" aria-pressed=${String(this.doc?.ui.new_ticket === v)} aria-checked=${String(this.doc?.ui.new_ticket === v)} data-ui-new=${v} ?disabled=${this.busy} @click=${() => void this.saveDoc({ ui: { new_ticket: v } })}>${tt(`n_${v}` as TicketTextKey)}</button>`)}</span></div>
        <ticket-board-settings .doc=${this.doc as unknown as BoardSettingsDoc} ?disabled=${this.busy} @doc-changed=${(e: CustomEvent<BoardSettingsDoc>) => { this.doc = e.detail as unknown as SettingsDoc; this.say(tt('setSaved')); }}></ticket-board-settings>
        ${this.longPressRow()}
      </sw-card>
      ${this.linksCard(this.doc)}
      ${this.hoursCard(this.doc)}
      <tickets-public-card .doc=${this.doc} ?busy=${this.busy} @save-doc=${(e: CustomEvent<{ patch: SettingsPatch }>) => void this.saveDoc(e.detail.patch)}
        @notice=${this.onNotice}></tickets-public-card>` : nothing}
    </div>`;
  }

  // ---------------------------------------------------------------- departments (slice 2: list + editor)

  private async addDepartment(): Promise<void> {
    // owner 2026-10-14: a name only - the server makes the identifier from it
    const name = this.newDept.name.trim();
    if (!name || this.busy) return;
    this.busy = true;
    try {
      const d = await ticketsApi().createDepartment({ name });
      this.departments = [...(this.departments ?? []), d];
      this.selected = d.id;
      this.newDept = { name: '', key: '' };
      this.say(tt('setSaved'));
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
    }
  }

  private onDeptChanged = (e: CustomEvent<{ dept: AdminDepartment; saved?: boolean }>) => {
    const d = e.detail.dept;
    this.departments = (this.departments ?? []).map((x) => (x.id === d.id ? d : x));
    if (e.detail.saved) this.say(tt('setSaved'));
  };

  private onDeptDeleted = (e: CustomEvent<{ id: string }>) => {
    this.departments = (this.departments ?? []).filter((x) => x.id !== e.detail.id);
    this.selected = this.departments[0]?.id ?? '';
    void this.loadDepartments().catch(() => undefined); // the deleted one joins "מחלקות שנמחקו"
  };

  /** owner 2026-10-14: a deleted department back with everything under it (tickets.configure; the server audits it). */
  private async restoreDepartment(id: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const d = await ticketsApi().restoreDepartment(id);
      await this.loadDepartments();
      this.selected = d.id;
      this.say(tt('depRestored'));
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
    }
  }

  private deletedCard(): TemplateResult | typeof nothing {
    if (!this.deletedDepts.length) return nothing;
    return html`<sw-card data-card="dept-deleted"><details data-dept-deleted>
      <summary>${tt('depDeletedList')} · ${this.deletedDepts.length}</summary>
      <div class="people">${repeat(this.deletedDepts, (d) => d.id, (d) => html`<div class="person" data-dept-deleted-item=${d.id}>
        <span class="who">${bidi(d.name)} <span class="muted">${new Date(d.deleted_at).toLocaleDateString('he-IL')}</span></span>
        <sw-button size="sm" data-dept-restore=${d.id} ?disabled=${this.busy} @click=${() => void this.restoreDepartment(d.id)}>${tt('depRestore')}</sw-button>
      </div>`)}</div>
    </details></sw-card>`;
  }

  private onNotice = (e: CustomEvent<{ ok?: string; error?: string }>) => {
    if (e.detail.error) this.fail(e.detail.error);
    else if (e.detail.ok) this.say(e.detail.ok);
  };

  private departmentsTab(): TemplateResult {
    if (!this.departments) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const sel = this.departments.find((d) => d.id === this.selected) ?? null;
    return html`<div class="split" data-dept-split>
      <div class="stack">
        <sw-card heading=${tt('depListTitle')} data-card="dept-list">
          ${this.departments.length ? html`<div class="dlist" role="list">${repeat(this.departments, (d) => d.id, (d) => html`<button type="button" role="listitem" class=${`ditem ${d.active ? '' : 'off'}`}
            aria-current=${String(d.id === this.selected)} data-dept-item=${d.id} @click=${() => (this.selected = d.id)}>
            <span class="txt"><span class="nm">${bidi(d.name)}</span>
              <span class="sub">${tt('depSummary', { c: d.categories.filter((c) => c.active).length, p: d.priorities.filter((p) => p.active).length, m: d.members.length })}</span></span>
            ${d.active ? nothing : html`<span class="tag">${tt('depInactive')}</span>`}</button>`)}</div>`
            : html`<sw-state-panel state="empty" heading=${tt('depNone')}></sw-state-panel>`}
          <div class="foot">
            <input class="in" maxlength="40" data-dept-new-name placeholder=${tt('depName')} aria-label=${tt('depAdd')} .value=${this.newDept.name} @input=${(e: Event) => (this.newDept = { ...this.newDept, name: (e.target as HTMLInputElement).value })}
              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.addDepartment(); }} />
            <sw-button size="sm" variant="primary" icon="plus" data-dept-add ?disabled=${this.busy || !this.newDept.name.trim()} @click=${() => void this.addDepartment()}>${tt('depNewShort')}</sw-button>
          </div>
        </sw-card>
        ${this.deletedCard()}
      </div>
      ${sel ? html`<tickets-dept-editor .dept=${sel} .directory=${this.directory} .installation=${this.installation}
        @dept-changed=${this.onDeptChanged} @dept-deleted=${this.onDeptDeleted} @notice=${this.onNotice} @dept-reload=${() => void this.loadDepartments()}></tickets-dept-editor>` : nothing}
    </div>`;
  }

  // ---------------------------------------------------------------- permissions (section 8.2)

  private grantOf(uid: string, perm: Perm): Grant | undefined {
    return this.holders?.users.find((u) => u.id === uid)?.grants.find((g) => g.via === 'grant' && g.role_id === `tickets_${perm}`);
  }

  private async toggleGrant(perm: Perm, on: boolean): Promise<void> {
    const uid = this.grantUser;
    if (!uid || this.busy) return;
    this.busy = true;
    try {
      const role = `tickets_${perm}`;
      if (on) {
        const [scopeType, ...rest] = this.grantScope.split(':');
        const until = this.grantUntil ? new Date(`${this.grantUntil}T23:59:59`).toISOString().replace(/\.\d+Z$/, 'Z') : null;
        await createBinding({ subject_kind: 'user', subject_id: uid, role_id: role, scope_type: scopeType, scope_id: rest.join(':'), ...(until ? { expires_at: until } : {}) });
      } else {
        const grant = this.grantOf(uid, perm);
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

  private viaText(g: Grant): string {
    const via = g.via === 'grant' ? tt('via_grant') : g.via === 'group' ? tt('via_group', { group: g.group_name ?? '' }) : tt('via_role', { role: g.role_name });
    const scope = g.scope_type !== 'installation' ? ` · ${tt('permScope', { scope: g.scope_name })}` : '';
    const until = g.expires_at ? ` · ${tt('permUntil', { date: new Date(g.expires_at).toLocaleDateString('he-IL') })}` : '';
    return via + scope + until;
  }

  private matrixCard(): TemplateResult {
    const roles = this.holders?.roles ?? [];
    if (!roles.length) return html``;
    return html`<sw-card heading=${tt('permHolders')} data-card="matrix">
      <div class="gridwrap" data-perm-matrix>
        <table class="matrix">
          <thead><tr><th>${tt('permMatrixRole')}</th>${PERMS.map((p) => html`<th>${tt(`p_${p}` as TicketTextKey)}${SENSITIVE_PERMS.includes(p) ? html`<br /><span class="tag warn">${tt('sensitive')}</span>` : nothing}</th>`)}</tr></thead>
          <tbody>${roles.map((r) => html`<tr data-role=${r.id}><td>${bidi(r.name ?? r.id)}${r.builtin ? nothing : html` <span class="tag">${tt('permCustom')}</span>`}</td>
            ${PERMS.map((p) => r.permissions.includes(`tickets.${p}`) ? html`<td class="yes" aria-label=${tt('yes')}>✓</td>` : html`<td class="no" aria-label=${tt('no')}>–</td>`)}</tr>`)}</tbody>
        </table>
      </div>
      <div class="pcards">${roles.map((r) => html`<div class="pcard" data-role-card=${r.id}><h4>${bidi(r.name ?? r.id)}</h4>
        <div class="chipsrow">${(r.permissions ?? []).length ? (r.permissions ?? []).map((p) => html`<span class="tag">${ticketPermLabel(p)}</span>`) : html`<span class="muted">–</span>`}</div></div>`)}</div>
      <div class="foot"><a href="#/system/access" data-to-roles>${tt('permToRoles')}</a></div>
    </sw-card>`;
  }

  private holdersCard(): TemplateResult {
    const h = this.holders!;
    const label = ticketPermLabel; // 2.5.0: the cost permissions have their words in the cost catalogue
    const byPerson = html`${h.users.length ? html`<div class="people">${repeat(h.users, (u) => u.id, (u) => html`<div class="person" data-holder=${u.id}>
        <span class="who">${bidi(u.name ?? u.id)}${u.active ? nothing : html` <span class="tag warn">${tt('permInactive')}</span>`}</span>
        ${u.grants.map((g) => html`<span class="chipsrow">${g.permissions.map((p) => html`<span class=${`tag ${SENSITIVE_PERMS.includes(p.replace(/^tickets\./, '') as Perm) ? 'warn' : ''}`}>${label(p)}</span>`)}${g.effect === 'deny' ? html`<span class="tag warn">${tt('permDeny')}</span>` : nothing}<span class="via">${this.viaText(g)}</span></span>`)}
      </div>`)}</div>` : html`<span class="muted">${tt('permNone')}</span>`}`;
    const byPerm = html`<div class="people">${PERMS.map((p) => {
      const who = h.users.filter((u) => u.grants.some((g) => g.effect === 'allow' && g.permissions.includes(`tickets.${p}`)));
      return html`<div class="person" data-holder-perm=${p}><span class="who">${tt(`p_${p}` as TicketTextKey)}${SENSITIVE_PERMS.includes(p) ? html` <span class="tag warn">${tt('sensitive')}</span>` : nothing}</span>
        <span class="chipsrow">${who.length ? who.map((u) => html`<span class="tag">${bidi(u.name ?? u.id)}</span>`) : html`<span class="muted">${tt('permNobody')}</span>`}</span></div>`;
    })}</div>`;
    return html`<sw-card heading=${tt('permPeople')} data-card="holders">
      <div class="row"><span class="lbl"></span><span class="seg" role="radiogroup" aria-label=${tt('permPeople')}>
        ${(['person', 'perm'] as const).map((v) => html`<button type="button" role="radio" aria-pressed=${String(this.holdersBy === v)} aria-checked=${String(this.holdersBy === v)} data-holders-by=${v} @click=${() => (this.holdersBy = v)}>${v === 'person' ? tt('permByPerson') : tt('permByPerm')}</button>`)}</span></div>
      ${this.holdersBy === 'person' ? byPerson : byPerm}
      <div class="foot"><a href="#/system/access" data-to-users>${tt('permToUsers')}</a></div>
    </sw-card>`;
  }

  private grantCard(): TemplateResult {
    const mayAssign = !isApi() || canAnywhere('rbac.assign');
    const today = new Date().toISOString().slice(0, 10);
    return html`<sw-card heading=${tt('permGrantCard')} data-card="grant">
      ${mayAssign ? html`
        <div class="row"><span class="lbl">${tt('permGrantUser')}</span>
          <select class="in" data-grant-user aria-label=${tt('permGrantPick')} @change=${(e: Event) => (this.grantUser = (e.target as HTMLSelectElement).value)}>
            <option value="" ?selected=${!this.grantUser}>${tt('permGrantPick')}</option>
            ${(this.directory?.users ?? []).map((u) => html`<option value=${u.id} ?selected=${u.id === this.grantUser}>${u.name}</option>`)}
          </select></div>
        ${this.grantUser ? html`
          <div class="row"><span class="lbl">${tt('permGrantScope')}</span>
            <select class="in" data-grant-scope aria-label=${tt('permGrantScope')} @change=${(e: Event) => (this.grantScope = (e.target as HTMLSelectElement).value)}>
              ${(this.scopes ?? [{ type: 'installation', id: '*', label: tt('permScopeAll') }]).map((s) => html`<option value=${`${s.type}:${s.id}`} ?selected=${this.grantScope === `${s.type}:${s.id}`}>${s.label}</option>`)}
            </select></div>
          <div class="row"><span class="lbl">${tt('permGrantUntil')}</span>
            <input class="in" type="date" min=${today} data-grant-until aria-label=${tt('permGrantUntil')} .value=${this.grantUntil} @input=${(e: Event) => (this.grantUntil = (e.target as HTMLInputElement).value)} /></div>
          <div class="chipsrow" data-grant-perms>${PERMS.map((p) => {
            const g = this.grantOf(this.grantUser, p);
            return html`<button type="button" class="rc" aria-pressed=${String(!!g)} data-grant=${p} ?disabled=${this.busy} title=${g ? this.viaText(g) : ''} @click=${() => void this.toggleGrant(p, !g)}>${g ? '✓ ' : '+ '}${tt(`p_${p}` as TicketTextKey)}${SENSITIVE_PERMS.includes(p) ? ` · ${tt('sensitive')}` : ''}</button>`;
          })}</div>` : nothing}`
        : html`<div class="row"><span class="muted">${tt('permGrantNoAssign')}</span><a href="#/system/access">${tt('permToUsers')}</a></div>`}
    </sw-card>`;
  }

  private permissionsTab(): TemplateResult {
    // 2.5.0 (14.10): never a spinner forever - a failed load or a render error is a clean error state with "try again"
    if (this.permsFailed) return this.permsError();
    if (!this.holders) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    try {
      return html`<div class="stack">${this.matrixCard()}${this.holdersCard()}${this.grantCard()}</div>`;
    } catch (e) {
      console.error('tickets permissions tab: render failed', e instanceof Error ? e.name : typeof e);
      return this.permsError();
    }
  }

  private permsError(): TemplateResult {
    return html`<sw-state-panel state="error" heading=${tt('permLoadFailed')} data-perms-error>
      <sw-button size="sm" data-perms-retry @click=${() => { this.permsFailed = false; this.holders = null; void this.loadTab(); }}>${tt('permRetry')}</sw-button>
    </sw-state-panel>`;
  }

  // ---------------------------------------------------------------- page

  render() {
    const heading = tt('area');
    if (this.enabled === null) return html`<sw-page crumbs="הגדרות" heading=${heading}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const channel = !isApi() || can('system.configure'); // slice 5b: the master switch and the e-mail fallback (PUT /tickets/channel)
    const templates = !isApi() || can('tickets.configure'); // slice 5b: message templates (D26)
    const costsTab = !isApi() || can('system.configure'); // slice 9b: the costs document (PUT /tickets/settings)
    const tabs = this.enabled ? html`<sw-tabs variant="underline" data-tickets-settings-tabs .items=${[
      { id: 'general', label: tt('setTabGeneral') }, { id: 'departments', label: tt('setTabDepartments') },
      ...(channel ? [{ id: 'channel', label: mtt('tabChannel') }] : []), ...(templates ? [{ id: 'messages', label: mtt('tabTemplates') }] : []), // slice 5b
      ...(costsTab ? [{ id: 'costs', label: ct('setTab') }] : []), // slice 9b
      { id: 'permissions', label: tt('setTabPermissions') },
    ]} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => this.setTab(e.detail.id)}></sw-tabs>` : nothing;
    const body = !this.enabled || this.tab === 'general' ? this.generalTab() : this.tab === 'departments' ? this.departmentsTab()
      : this.tab === 'channel' ? html`<tickets-channel-settings @notice=${this.onNotice}></tickets-channel-settings>` // slice 5b
      : this.tab === 'messages' ? html`<tickets-message-templates @notice=${this.onNotice}></tickets-message-templates>` // slice 5b
      : this.tab === 'costs' ? html`<tickets-costs-settings @notice=${this.onNotice}></tickets-costs-settings>` // slice 9b
      : this.permissionsTab();
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
