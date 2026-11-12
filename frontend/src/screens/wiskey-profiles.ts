import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dropdown';
import type { DropdownChange } from '../components/sw-dropdown';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import '../components/sw-toggle';
import type { RouteState } from '../router';
import { ApiError, describeError } from '../api/client';
import { isApi } from '../api/session';
import {
  getCompare, getProfiles, getProfilesAccess, getRollbackDraft, getSuggestions, getVersions, postApply, postCheck, postPreview,
  type ApplyReply, type CompareReply, type DiffRow, type PolicyValues, type PreviewReply, type ProfileField, type ProfileGroup, type ProfilesView,
  type RollbackDraft, type Suggestions, type VersionsPage,
} from '../api/access-profiles';
import { getAcPeople } from '../api/access-people';
import {
  FIELD_TYPES, FIELDS_MAX, GROUPS_MAX, SUGGEST_FIELDS_MAX, canRemove, changeCount, clone, diffRows, draftProblems, move, newField, newGroup, outcomeOf, parentCandidates,
  parseOptions, personDelta, problemsOf, resultTone, secondsLeft, sortPeople, toggleStation, valueText, type Problems,
} from '../access-control/profiles-logic';
import { PF_HE, pft, pftDynamic, type PfKey } from '../i18n/wiskey-profiles';

type Tab = 'draft' | 'versions' | 'suggest';
type Phase = 'edit' | 'preview' | 'result';

/**
 * WISKEY-PROFILES-EDIT-2390 (plan 2026-11-03 T8; owner decision 03.11 Q4 "a"): "קבוצות ושדות" (`#/wiskey/profiles`) - the person groups
 * and the profile fields of the access-control system, edited in Arx:
 *  - "עריכה": the draft (groups with the stations each opens, fields with type / required / unique / options / condition, the photo
 *    switch). Existing definitions can be disabled, never removed (the access-control system archives them);
 *  - "תצוגה מקדימה": the access-control system's own impact review - who gains / loses which station, which stations will be synced,
 *    the field checks (missing / invalid / duplicate values) - nothing is saved yet;
 *  - confirmation (the impact sentence + "בדקתי את ההשפעה") -> one apply -> the honest result: saved, read back, stations asked to sync
 *    (not verified); no clear answer -> "check what happened" (a readback), never a resend;
 *  - "גרסאות": the retained history, compare with the current one, and "טען כטיוטת שחזור" (a draft that then goes the same way);
 *  - "הצעות קבוצה": read-only suggestions for one person.
 * Permission: people management at installation scope (the server decides; this screen only shapes itself from the answers).
 */
@customElement('wiskey-profiles-screen')
export class WiskeyProfilesScreen extends LitElement {
  @property({ attribute: false }) route: RouteState | null = null;

  @state() private tab: Tab = 'draft';
  @state() private phase: Phase = 'edit';
  @state() private load: 'loading' | 'ready' | 'error' | 'forbidden' | 'unsupported' = 'loading';
  @state() private loadError = '';
  @state() private view: ProfilesView | null = null;
  @state() private base: PolicyValues | null = null;
  @state() private draft: PolicyValues | null = null;
  @state() private baseRevision = 0;
  @state() private rollback: RollbackDraft | null = null;
  @state() private serverProblems: Problems = {};
  @state() private busy = false;
  @state() private error = '';
  @state() private previewReply: PreviewReply | null = null;
  @state() private confirmOpen = false;
  @state() private confirmChecked = false;
  @state() private result: ApplyReply | null = null;
  @state() private resultError: { outcome: string; code: string; message: string } | null = null;
  @state() private checkLine = '';
  @state() private now = Date.now();
  // versions
  @state() private versions: VersionsPage | null = null;
  @state() private versionsError = '';
  @state() private compare: CompareReply | null = null;
  @state() private compareError = '';
  // suggestions
  @state() private peopleQuery = '';
  @state() private people: { id: string; display_name: string }[] = [];
  @state() private person: { id: string; display_name: string } | null = null;
  @state() private suggest: Suggestions | null = null;
  @state() private suggestFields: string[] = [];
  @state() private suggestError = '';

  private timer = 0;

  connectedCallback(): void {
    super.connectedCallback();
    void this.reload();
    this.timer = window.setInterval(() => (this.now = Date.now()), 1000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  private async reload(): Promise<void> {
    this.load = 'loading';
    this.error = '';
    if (!isApi()) {
      this.load = 'forbidden';
      return;
    }
    try {
      const access = await getProfilesAccess();
      if (!access.can_edit) {
        this.load = 'forbidden';
        return;
      }
      const v = await getProfiles();
      this.view = v;
      if (v.state === 'unsupported' || v.features.view.available === false) {
        this.load = 'unsupported';
        return;
      }
      if (!v.policy) {
        this.load = 'error';
        this.loadError = v.last_error || v.state;
        return;
      }
      const values: PolicyValues = { photo_enabled: v.policy.photo_enabled, fields: v.policy.fields, groups: v.policy.groups };
      this.base = clone(values);
      this.draft = clone(values);
      this.baseRevision = v.policy.revision;
      this.rollback = null;
      this.serverProblems = {};
      this.phase = 'edit';
      this.previewReply = null;
      this.load = 'ready';
    } catch (err) {
      this.load = err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error';
      this.loadError = describeError(err);
    }
  }

  // ---------------------------------------------------------------- derived
  private get known(): Set<string> {
    const s = new Set((this.view?.stations ?? []).map((x) => x.id));
    for (const g of this.base?.groups ?? []) for (const id of g.station_ids ?? []) s.add(id);
    return s;
  }

  private get names(): Record<string, string> {
    return Object.fromEntries((this.view?.stations ?? []).map((s) => [s.id, s.name]));
  }

  private get problems(): Problems {
    return this.draft ? { ...draftProblems(this.draft, this.known), ...this.serverProblems } : {};
  }

  private get rows(): DiffRow[] {
    return this.base && this.draft ? diffRows(this.base, this.draft) : [];
  }

  private edit(mut: (d: PolicyValues) => void): void {
    if (!this.draft) return;
    const d = clone(this.draft);
    mut(d);
    this.draft = d;
    this.serverProblems = {};
    this.error = '';
  }

  private setField(i: number, patch: Partial<ProfileField>): void {
    this.edit((d) => (d.fields[i] = { ...d.fields[i], ...patch }));
  }

  private setGroup(i: number, patch: Partial<ProfileGroup>): void {
    this.edit((d) => (d.groups[i] = { ...d.groups[i], ...patch }));
  }

  // ---------------------------------------------------------------- preview / apply
  private async preview(): Promise<void> {
    if (!this.draft || this.busy || Object.keys(this.problems).length) return;
    this.busy = true;
    this.error = '';
    try {
      this.previewReply = await postPreview(this.baseRevision, this.draft);
      this.phase = 'preview';
      this.confirmChecked = false;
    } catch (err) {
      this.serverProblems = problemsOf(err);
      this.error = this.errorText(err);
    } finally {
      this.busy = false;
    }
  }

  private errorText(err: unknown): string {
    if (err instanceof ApiError) return `e_${err.code}` in PF_HE ? pft(`e_${err.code}` as PfKey) : err.message || err.code;
    return pft('e_network');
  }

  private async apply(): Promise<void> {
    const p = this.previewReply;
    if (!p || this.busy || !this.confirmChecked) return;
    this.busy = true;
    this.resultError = null;
    this.checkLine = '';
    try {
      this.result = await postApply(p.review_id);
    } catch (err) {
      const o = outcomeOf(err);
      this.result = null;
      this.resultError = { outcome: o.outcome, code: o.code, message: err instanceof ApiError ? err.message : pft('e_network') };
    } finally {
      this.busy = false;
      this.confirmOpen = false;
      this.phase = 'result';
    }
  }

  private async check(): Promise<void> {
    const p = this.previewReply;
    if (!p || this.busy) return;
    this.busy = true;
    try {
      const r = await postCheck(p.review_id);
      if (r.verdict === 'applied') {
        this.checkLine = pft('checkApplied', { n: r.readback.revision ?? '' });
        this.resultError = null;
        this.result = r.result;
      } else if (r.verdict === 'not_applied') {
        this.checkLine = pft('checkNotApplied');
        this.resultError = { outcome: 'not_sent', code: 'not_applied', message: pft('checkNotApplied') };
      } else this.checkLine = pft('checkElsewhere');
    } catch (err) {
      this.checkLine = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private closeResult(): void {
    if (this.result) void this.reload();
    else {
      this.phase = 'edit';
      this.previewReply = null;
    }
    this.result = null;
    this.resultError = null;
    this.checkLine = '';
  }

  // ---------------------------------------------------------------- versions
  private async loadVersions(offset = 0): Promise<void> {
    this.versionsError = '';
    try {
      this.versions = (await getVersions(offset, 20)).versions;
    } catch (err) {
      this.versionsError = err instanceof ApiError ? pftDynamic(`e_${err.code}`, 'e_network') : pft('e_network');
    }
  }

  private async compareWith(revision: number): Promise<void> {
    this.compareError = '';
    this.compare = null;
    try {
      this.compare = (await getCompare(revision, this.baseRevision)).compare;
    } catch (err) {
      this.compareError = err instanceof ApiError ? pftDynamic(`e_${err.code}`, 'e_network') : pft('e_network');
    }
  }

  private async loadRollback(revision: number): Promise<void> {
    this.compareError = '';
    try {
      const r = await getRollbackDraft(revision);
      if (r.base_revision !== this.baseRevision) await this.reload();
      this.draft = clone(r.values);
      this.rollback = r;
      this.tab = 'draft';
      this.phase = 'edit';
    } catch (err) {
      this.compareError = err instanceof ApiError ? pftDynamic(`e_${err.code}`, 'e_network') : pft('e_network');
    }
  }

  // ---------------------------------------------------------------- suggestions
  private async searchPeople(): Promise<void> {
    this.suggestError = '';
    try {
      const r = await getAcPeople({ query: this.peopleQuery.trim(), filters: {}, offset: 0, limit: 20, snapshot: '' });
      this.people = (r.people?.records ?? []).map((p) => ({ id: p.id, display_name: p.display_name }));
    } catch (err) {
      this.suggestError = describeError(err);
    }
  }

  private async pickPerson(p: { id: string; display_name: string }): Promise<void> {
    this.person = p;
    this.suggestFields = [];
    await this.runSuggest();
  }

  private async runSuggest(): Promise<void> {
    if (!this.person) return;
    this.suggestError = '';
    try {
      this.suggest = (await getSuggestions(this.person.id, this.suggestFields)).suggestions;
    } catch (err) {
      this.suggest = null;
      this.suggestError = err instanceof ApiError ? err.message : pft('e_network');
    }
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    if (tab === 'versions' && !this.versions) void this.loadVersions();
  }

  // ---------------------------------------------------------------- render
  render(): TemplateResult {
    const title = pft('title');
    if (this.load === 'loading') return html`<sw-page heading=${title}><sw-state-panel state="loading" heading=${pft('loading')} data-pf-state="loading"></sw-state-panel></sw-page>`;
    if (this.load === 'forbidden') {
      return html`<sw-page heading=${title}><sw-state-panel quiet state="forbidden" heading=${pft('noPermission')} hint=${pft('noPermissionHint')} data-pf-state="forbidden"></sw-state-panel></sw-page>`;
    }
    if (this.load === 'unsupported') return html`<sw-page heading=${title}><sw-state-panel icon="users" quiet state="empty" heading=${pft('unsupported')} data-pf-state="unsupported"></sw-state-panel></sw-page>`;
    if (this.load === 'error' || !this.draft || !this.base) {
      return html`<sw-page heading=${title}><sw-state-panel state="error" heading=${pft('loadError')} hint=${this.loadError} actionLabel=${pft('retry')} @action=${() => void this.reload()}
        data-pf-state="error"></sw-state-panel></sw-page>`;
    }
    return html`<sw-page wide heading=${title} subheading=${pft('sub')} data-pf data-pf-state="ready" data-pf-phase=${this.phase}>
      <div class="tabs" role="tablist" aria-label=${title}>
        ${(['draft', 'versions', 'suggest'] as Tab[]).map((t) => html`<button role="tab" aria-selected=${String(this.tab === t)} class=${this.tab === t ? 'on' : ''} data-pf-tab=${t}
          @click=${() => this.setTab(t)}>${pft(t === 'draft' ? 'tabDraft' : t === 'versions' ? 'tabVersions' : 'tabSuggest')}</button>`)}
      </div>
      ${this.tab === 'draft' ? (this.phase === 'edit' ? this.renderEditor() : this.phase === 'preview' ? this.renderPreview() : this.renderResult()) : nothing}
      ${this.tab === 'versions' ? this.renderVersions() : nothing}
      ${this.tab === 'suggest' ? this.renderSuggest() : nothing}
      ${this.confirmOpen ? this.renderConfirm() : nothing}
    </sw-page>`;
  }

  private renderEditor(): TemplateResult {
    const d = this.draft as PolicyValues;
    const problems = this.problems;
    const rows = this.rows;
    const n = changeCount(rows);
    const editable = this.view?.features.edit.available !== false;
    return html`<div class="stack">
      <div class="bar" data-pf-bar>
        <div class="bar-text">
          <b data-pf-base>${this.rollback ? pft('rollbackOf', { n: this.rollback.target_revision }) : pft('draftOf', { n: this.baseRevision })}</b>
          <span class="muted" data-pf-dirty=${n}>${n ? pft('dirty', { n }) : pft('clean')}</span>
        </div>
        <div class="bar-acts">
          <sw-button variant="ghost" icon="refresh" ?disabled=${this.busy} data-pf-discard @click=${() => void this.reload()}>${n || this.rollback ? pft('discard') : pft('reload')}</sw-button>
          <sw-button variant="primary" icon="eye" ?disabled=${!editable || this.busy || !n || Object.keys(problems).length > 0} data-pf-preview @click=${() => void this.preview()}>
            ${this.busy ? pft('previewing') : pft('preview')}</sw-button>
        </div>
      </div>
      ${!editable ? html`<p class="note warn" data-pf-edit-unsupported>${pft('partUnsupported')}</p>` : nothing}
      ${this.rollback ? html`<div class="note" data-pf-rollback-notes><b>${pft('rollbackHint')}</b>
        <ul>${this.rollback.notes.map((x) => html`<li data-pf-note=${x.code}>${pftDynamic(`note_${x.code}`, 'none', { id: this.itemLabel(x.id) })}</li>`)}</ul></div>` : nothing}
      ${this.error ? html`<p class="note err" role="alert" data-pf-error>${this.error}</p>` : nothing}
      ${Object.keys(problems).length ? html`<p class="note warn" data-pf-problems>${pft('problemsTitle')} (${Object.keys(problems).length})</p>` : nothing}

      <section class="card" data-pf-groups>
        <header><h2>${pft('groupsTitle')}</h2><span class="muted">${pft('groupsHint')}</span></header>
        ${d.groups.map((g, i) => this.renderGroup(g, i, problems))}
        <div><sw-button variant="secondary" icon="plus" ?disabled=${d.groups.length >= GROUPS_MAX} data-pf-add-group
          @click=${() => this.edit((x) => x.groups.push(newGroup(x, pft('newGroupLabel'))))}>${pft('addGroup')}</sw-button></div>
      </section>

      <section class="card" data-pf-fields>
        <header><h2>${pft('fieldsTitle')}</h2><span class="muted">${pft('fieldsHint')}</span></header>
        ${d.fields.map((f, i) => this.renderField(f, i, problems))}
        <div><sw-button variant="secondary" icon="plus" ?disabled=${d.fields.length >= FIELDS_MAX} data-pf-add-field
          @click=${() => this.edit((x) => x.fields.push(newField(x, pft('newFieldLabel'))))}>${pft('addField')}</sw-button></div>
      </section>

      <section class="card" data-pf-settings>
        <header><h2>${pft('settingsTitle')}</h2></header>
        <label class="row-inline"><sw-toggle .checked=${d.photo_enabled} label=${pft('photoEnabled')} data-pf-photo
          @change=${(e: CustomEvent<{ checked: boolean }>) => this.edit((x) => (x.photo_enabled = e.detail.checked))}></sw-toggle></label>
      </section>
    </div>`;
  }

  private itemLabel(path: string): string {
    const [kind, id] = path.split('.');
    const list = (kind === 'fields' ? this.draft?.fields : kind === 'groups' ? this.draft?.groups : null) ?? [];
    return (list as { id: string; label: string }[]).find((x) => x.id === id)?.label ?? id ?? path;
  }

  private mark(kind: 'fields' | 'groups', id: string): TemplateResult | typeof nothing {
    const saved = (kind === 'fields' ? this.base?.fields : this.base?.groups)?.find((x) => x.id === id);
    if (!saved) return html`<sw-badge kind="live" label=${pft('newItem')} data-pf-mark="new"></sw-badge>`;
    const now = (kind === 'fields' ? this.draft?.fields : this.draft?.groups)?.find((x) => x.id === id);
    return JSON.stringify(saved) !== JSON.stringify(now) ? html`<sw-badge kind="partial" label=${pft('edited')} data-pf-mark="edited"></sw-badge>` : nothing;
  }

  private problem(problems: Problems, path: string): TemplateResult | typeof nothing {
    const code = problems[path];
    return code ? html`<span class="problem" role="alert" data-pf-problem=${path}>${pftDynamic(`p_${code}`, 'p_shape')}</span>` : nothing;
  }

  private renderGroup(g: ProfileGroup, i: number, problems: Problems): TemplateResult {
    const stations = this.view?.stations ?? [];
    const chosen = new Set(g.station_ids ?? []);
    const extra = [...chosen].filter((s) => !stations.some((x) => x.id === s));
    return html`<div class="item ${g.enabled ? '' : 'off'}" data-pf-group=${g.id}>
      <div class="item-top">
        <label class="lbl"><span class="sr">${pft('label')}</span>
          <input type="text" maxlength="64" .value=${g.label} aria-label=${pft('label')} data-pf-group-label
            @input=${(e: Event) => this.setGroup(i, { label: (e.target as HTMLInputElement).value })} /></label>
        ${this.mark('groups', g.id)}
        <sw-toggle .checked=${g.enabled} label=${pft('enabled')} data-pf-group-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => this.setGroup(i, { enabled: e.detail.checked })}></sw-toggle>
        ${canRemove(this.base, 'groups', g.id)
          ? html`<sw-button variant="ghost" size="sm" icon="trash" iconOnly label=${pft('remove')} data-pf-group-remove @click=${() => this.edit((x) => x.groups.splice(i, 1))}></sw-button>`
          : nothing}
      </div>
      ${this.problem(problems, `groups.${i}.label`)}${this.problem(problems, `groups.${i}.id`)}
      <div class="chips" role="group" aria-label=${pft('stations')}>
        ${stations.map((s) => {
          const on = chosen.has(s.id);
          const blocked = !on && !s.lock_enabled;
          return html`<button type="button" class="chip ${on ? 'on' : ''}" aria-pressed=${String(on)} ?disabled=${blocked} data-pf-station=${s.id}
            title=${blocked ? pft('stationNoLock') : !s.online ? pft('stationOffline') : s.name} @click=${() => this.setGroup(i, toggleStation(g, s.id))}>
            ${s.name}${!s.online ? html`<span class="dot" aria-label=${pft('stationOffline')}></span>` : nothing}</button>`;
        })}
        ${extra.map((s) => html`<button type="button" class="chip on unknown" aria-pressed="true" data-pf-station=${s} title=${pft('stationUnknown')}
          @click=${() => this.setGroup(i, toggleStation(g, s))}>${s}</button>`)}
        ${!chosen.size ? html`<span class="muted" data-pf-no-stations>${pft('stationsNone')}</span>` : nothing}
      </div>
      ${this.problem(problems, `groups.${i}.station_ids`)}
    </div>`;
  }

  private renderField(f: ProfileField, i: number, problems: Problems): TemplateResult {
    const d = this.draft as PolicyValues;
    const parents = parentCandidates(d.fields, f.id);
    const parent = f.depends_on ? d.fields.find((x) => x.id === f.depends_on?.field_id) : undefined;
    return html`<div class="item ${f.enabled ? '' : 'off'}" data-pf-field=${f.id}>
      <div class="item-top">
        <label class="lbl"><span class="sr">${pft('label')}</span>
          <input type="text" maxlength="64" .value=${f.label} aria-label=${pft('label')} data-pf-field-label
            @input=${(e: Event) => this.setField(i, { label: (e.target as HTMLInputElement).value })} /></label>
        ${this.mark('fields', f.id)}
        ${f.depends_on ? html`<sw-badge kind="neutral" label=${pft('conditional')} data-pf-conditional></sw-badge>` : nothing}
        <sw-toggle .checked=${f.enabled} label=${pft('enabled')} data-pf-field-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => this.setField(i, { enabled: e.detail.checked })}></sw-toggle>
        <span class="moves">
          <button type="button" class="mv" aria-label=${pft('moveUp')} title=${pft('moveUp')} ?disabled=${i === 0} data-pf-field-up @click=${() => this.edit((x) => (x.fields = move(x.fields, i, -1)))}>↑</button>
          <button type="button" class="mv" aria-label=${pft('moveDown')} title=${pft('moveDown')} ?disabled=${i === d.fields.length - 1} data-pf-field-down
            @click=${() => this.edit((x) => (x.fields = move(x.fields, i, 1)))}>↓</button>
          ${canRemove(this.base, 'fields', f.id)
            ? html`<sw-button variant="ghost" size="sm" icon="trash" iconOnly label=${pft('remove')} data-pf-field-remove @click=${() => this.edit((x) => x.fields.splice(i, 1))}></sw-button>`
            : nothing}
        </span>
      </div>
      ${this.problem(problems, `fields.${i}.label`)}${this.problem(problems, `fields.${i}.id`)}
      <div class="grid">
        <div class="f"><span>${pft('type')}</span>
          <sw-dropdown block data-pf-field-type label=${pft('type')} .value=${f.type}
            .items=${FIELD_TYPES.map((t) => ({ id: t, label: pftDynamic(`type_${t}`, 'type_text') }))}
            @change=${(e: CustomEvent<DropdownChange>) => this.setField(i, { type: e.detail.id as ProfileField['type'] })}></sw-dropdown></div>
        <label class="ck"><input type="checkbox" .checked=${f.required} data-pf-field-required @change=${(e: Event) => this.setField(i, { required: (e.target as HTMLInputElement).checked })} />
          ${pft('required')}</label>
        <label class="ck"><input type="checkbox" .checked=${f.unique} data-pf-field-unique @change=${(e: Event) => this.setField(i, { unique: (e.target as HTMLInputElement).checked })} />
          ${pft('unique')}</label>
        <div class="f"><span>${pft('dependsOn')}</span>
          <sw-dropdown block data-pf-field-parent label=${pft('dependsOn')} .value=${f.depends_on?.field_id ?? ''}
            .items=${[{ id: '', label: pft('dependsNone') }, ...parents.map((p) => ({ id: p.id, label: p.label }))]}
            @change=${(e: CustomEvent<DropdownChange>) => {
              const v = e.detail.id;
              this.setField(i, { depends_on: v ? { field_id: v, value: '' } : null });
            }}></sw-dropdown></div>
        ${f.depends_on
          ? html`<label class="f"><span>${pft('dependsValue')}</span>
              ${parent?.type === 'select'
                ? html`<sw-dropdown block data-pf-field-parent-value label=${pft('dependsValue')} .value=${f.depends_on.value}
                    .items=${[{ id: '', label: '—' }, ...parent.options.map((o) => ({ id: o, label: o }))]}
                    @change=${(e: CustomEvent<DropdownChange>) => this.setField(i, { depends_on: { field_id: f.depends_on!.field_id, value: e.detail.id } })}></sw-dropdown>`
                : html`<input type="text" maxlength="100" .value=${f.depends_on.value} data-pf-field-parent-value
                    @input=${(e: Event) => this.setField(i, { depends_on: { field_id: f.depends_on!.field_id, value: (e.target as HTMLInputElement).value } })} />`}</label>`
          : nothing}
      </div>
      ${this.problem(problems, `fields.${i}.depends_on`)}
      ${f.type === 'select'
        ? html`<label class="f wide"><span>${pft('options')} <span class="muted">(${pft('optionsHint')})</span></span>
            <textarea rows="3" data-pf-field-options .value=${f.options.join('\n')} @change=${(e: Event) => this.setField(i, { options: parseOptions((e.target as HTMLTextAreaElement).value) })}></textarea></label>
            ${this.problem(problems, `fields.${i}.options`)}`
        : nothing}
    </div>`;
  }

  private diffList(rows: readonly DiffRow[]): TemplateResult {
    const names = this.names;
    const labels = Object.fromEntries((this.draft?.fields ?? []).map((f) => [f.id, f.label]));
    const words = { yes: pft('yes'), no: pft('no'), none: pft('none'), types: { text: pft('type_text'), select: pft('type_select'), number: pft('type_number'), date: pft('type_date') } };
    return html`<ul class="diff" data-pf-diff>${rows.map((r) => html`<li data-pf-diff-row=${`${r.kind}.${r.id}`}>
      <div class="diff-head"><span class="muted">${pftDynamic(`kind_${r.kind}`, 'kind_fields')}</span> <b>${r.kind === 'settings' ? pft('photoEnabled') : r.label}</b>
        <sw-badge kind=${r.state === 'added' ? 'live' : r.state === 'removed' ? 'error' : 'partial'} label=${pftDynamic(`state_${r.state}`, 'state_changed')}></sw-badge></div>
      ${r.changes.length
        ? html`<dl>${r.changes.map((c) => html`<dt>${pftDynamic(`prop_${c.property}`, 'prop_label')}</dt>
            <dd><span class="before" data-pf-before>${valueText(c.property, c.before, names, labels, words)}</span> <span aria-hidden="true">←</span>
              <span class="after" data-pf-after>${valueText(c.property, c.after, names, labels, words)}</span></dd>`)}</dl>`
        : nothing}
    </li>`)}</ul>`;
  }

  private renderPreview(): TemplateResult {
    const p = this.previewReply as PreviewReply;
    const im = p.impact;
    const left = secondsLeft(p.expires_at, this.now);
    const names = im.station_names;
    const people = sortPeople(im.people);
    return html`<div class="stack" data-pf-preview-panel>
      <div class="bar">
        <div class="bar-text"><b>${pft('previewTitle')}</b><span class="muted">${pft('previewSub')}</span></div>
        <div class="bar-acts">
          <sw-button variant="ghost" icon="chevronBack" data-pf-back @click=${() => ((this.phase = 'edit'), (this.previewReply = null))}>${pft('back')}</sw-button>
          <sw-button variant="primary" icon="check" ?disabled=${!im.can_apply || left <= 0 || this.busy} data-pf-confirm-open
            @click=${() => ((this.confirmOpen = true), (this.confirmChecked = false))}>${pft('confirmApply')}</sw-button>
        </div>
      </div>
      ${!im.can_apply ? html`<p class="note err" role="alert" data-pf-blocked>${pft('blocked')}</p>` : nothing}
      <p class="muted" data-pf-expiry>${left > 0 ? pft('expiresAt', { time: new Date(p.expires_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }) : pft('expired')}
        · ${pft('deviceWrites')}</p>

      <section class="card"><header><h2>${pft('changesTitle')}</h2></header>${this.diffList(p.diff)}</section>

      <section class="card" data-pf-impact>
        <header><h2>${pft('impactPeople')}</h2>
          <span class="count" data-pf-impact-changed=${im.changed}>${pft('impactPeopleCount', { n: im.changed })}</span></header>
        ${im.changed === 0 && !people.some((x) => x.changed) ? html`<p class="muted" data-pf-impact-none>${pft('impactNone')}</p>` : nothing}
        ${people.length
          ? html`<p class="muted">${pft('impactListed', { n: people.length })}${im.people_truncated ? ` · ${pft('impactTruncated')}` : ''}</p>
            <ul class="people" data-pf-people>${people.map((x) => {
              const dlt = personDelta(x);
              return html`<li data-pf-person=${x.user_id} class=${x.changed ? 'changed' : ''}>
                <b>${x.display_name}</b>${x.employee_no ? html` <span class="muted">${x.employee_no}</span>` : nothing}
                ${dlt.gains.length ? html`<span class="gain" data-pf-gains>${pft('gains')}: ${dlt.gains.map((s) => names[s] ?? s).join(', ')}</span>` : nothing}
                ${dlt.loses.length ? html`<span class="lose" data-pf-loses>${pft('loses')}: ${dlt.loses.map((s) => names[s] ?? s).join(', ')}</span>` : nothing}
                ${!dlt.gains.length && !dlt.loses.length ? html`<span class="muted">${pft('noChange')}</span>` : nothing}
                ${x.overrides ? html`<span class="muted">${pft('overrides', { n: x.overrides })}</span>` : nothing}
              </li>`;
            })}</ul>`
          : nothing}
        <div class="kv">
          <div><span class="muted">${pft('impactStations')}</span> <b data-pf-impact-stations=${im.stations.length}>${im.stations.length ? im.stations.map((s) => names[s] ?? s).join(', ') : pft('none')}</b></div>
          ${im.offline.length ? html`<div><span class="muted">${pft('impactOffline')}</span> <b data-pf-impact-offline>${im.offline.map((s) => names[s] ?? s).join(', ')}</b></div>` : nothing}
        </div>
      </section>

      ${im.field_changes.length
        ? html`<section class="card" data-pf-fields-impact><header><h2>${pft('fieldsImpact')}</h2></header>
            ${im.field_changes.map((f) => html`<div class="fi ${f.duplicates ? 'bad' : ''}" data-pf-field-impact=${f.field_id}>
              <b>${f.label}</b> <span class="muted">${pft('fieldChecked', { n: f.checked })}</span>
              ${f.missing ? html`<span class="warn-t">${pft('fieldMissing', { n: f.missing })}</span>` : nothing}
              ${f.invalid ? html`<span class="warn-t">${pft('fieldInvalid', { n: f.invalid })}</span>` : nothing}
              ${f.duplicates ? html`<span class="err-t" data-pf-dups=${f.duplicates}>${pft('fieldDuplicates', { n: f.duplicates })}</span>` : nothing}
              ${f.newly_applicable ? html`<span class="muted">${pft('fieldNewlyApplicable', { n: f.newly_applicable })}</span>` : nothing}
              ${f.template_issues ? html`<span class="muted">${pft('fieldTemplates', { n: f.template_issues })}</span>` : nothing}
              ${f.examples.length || f.duplicate_examples.length
                ? html`<div class="muted ex">${[...f.duplicate_examples, ...f.examples].map((e) => e.display_name).join(' · ')}</div>`
                : nothing}
            </div>`)}
          </section>`
        : nothing}
    </div>`;
  }

  private renderConfirm(): TemplateResult {
    const p = this.previewReply as PreviewReply;
    const from = p.base_revision;
    const sentence = p.impact.changed
      ? pft('confirmText', { from, to: from + 1, people: p.impact.changed, stations: p.impact.stations.length })
      : pft('confirmTextNoAccess', { from, to: from + 1 });
    return html`<sw-dialog open heading=${pft('confirmTitle')} @close=${() => (this.confirmOpen = false)} data-pf-confirm>
      <p data-pf-confirm-sentence>${sentence}</p>
      <label class="ck"><input type="checkbox" .checked=${this.confirmChecked} data-pf-confirm-check
        @change=${(e: Event) => (this.confirmChecked = (e.target as HTMLInputElement).checked)} /> ${pft('confirmCheck')}</label>
      <div slot="footer" class="dlg-acts">
        <sw-button variant="ghost" data-pf-confirm-cancel @click=${() => (this.confirmOpen = false)}>${pft('cancel')}</sw-button>
        <sw-button variant="primary" icon="check" ?disabled=${!this.confirmChecked || this.busy} data-pf-confirm-send @click=${() => void this.apply()}>
          ${this.busy ? pft('saving') : pft('confirmApply')}</sw-button>
      </div>
    </sw-dialog>`;
  }

  private renderResult(): TemplateResult {
    const r = this.result;
    if (r) {
      const tone = resultTone(r);
      const rb = r.readback;
      return html`<section class="card result ${tone}" data-pf-result="saved" data-pf-tone=${tone} role="status">
        <header><h2>${pft('resultSaved')}</h2></header>
        ${r.repeated ? html`<p data-pf-repeated>${pft('resultRepeated')}</p>` : nothing}
        <p data-pf-readback>${rb.matches ? pft('resultReadbackOk', { n: rb.revision ?? '' }) : rb.revision !== null ? pft('resultReadbackOther', { n: rb.revision }) : pft('resultReadbackFail')}</p>
        ${r.receipt ? html`<p data-pf-changed>${pft('resultChanged', { n: r.receipt.changed })}</p>` : nothing}
        <p data-pf-sync>${r.receipt && r.receipt.stations.length ? pft('resultSync', { n: r.receipt.stations.length }) : pft('resultNoSync')}</p>
        ${this.checkLine ? html`<p class="muted" data-pf-check-line>${this.checkLine}</p>` : nothing}
        <div><sw-button variant="primary" data-pf-done @click=${() => this.closeResult()}>${pft('done')}</sw-button></div>
      </section>`;
    }
    const e = this.resultError;
    const unknown = e?.outcome === 'unknown';
    return html`<section class="card result ${unknown ? 'warn' : 'err'}" data-pf-result=${unknown ? 'unknown' : 'not_saved'} data-pf-outcome=${e?.outcome ?? ''} role="alert">
      <header><h2>${unknown ? pft('resultUnknown') : pft('resultNotSaved')}</h2></header>
      <p data-pf-result-text>${unknown ? pft('resultUnknownText') : e ? pftDynamic(`e_${e.code}`, 'outcome_refused') : ''}</p>
      ${e && !unknown ? html`<p class="muted">${e.message}</p>` : nothing}
      ${this.checkLine ? html`<p data-pf-check-line>${this.checkLine}</p>` : nothing}
      <div class="row-inline">
        ${unknown ? html`<sw-button variant="primary" icon="search" ?disabled=${this.busy} data-pf-check @click=${() => void this.check()}>${this.busy ? pft('checking') : pft('check')}</sw-button>` : nothing}
        ${!unknown && e?.code === 'not_applied'
          ? html`<sw-button variant="primary" data-pf-reapply @click=${() => ((this.phase = 'preview'), (this.resultError = null))}>${pft('confirmApply')}</sw-button>`
          : nothing}
        <sw-button variant=${unknown ? 'ghost' : 'primary'} data-pf-new-preview @click=${() => void this.reload()}>${pft('reload')}</sw-button>
      </div>
    </section>`;
  }

  private renderVersions(): TemplateResult {
    const v = this.versions;
    if (this.view?.features.versions.available === false) return html`<p class="note warn" data-pf-versions-unsupported>${pft('partUnsupported')}</p>`;
    if (this.versionsError) return html`<sw-state-panel state="error" heading=${this.versionsError} actionLabel=${pft('retry')} @action=${() => void this.loadVersions()} data-pf-versions-error></sw-state-panel>`;
    if (!v) return html`<sw-state-panel state="loading" heading=${pft('loading')}></sw-state-panel>`;
    const canCompare = this.view?.features.compare.available !== false;
    return html`<div class="stack" data-pf-versions>
      <section class="card"><header><h2>${pft('versionsTitle')}</h2><span class="muted">${pft('versionsHint')}</span></header>
        ${!v.records.length ? html`<p class="muted">${pft('versionsEmpty')}</p>` : nothing}
        <ul class="versions">${v.records.map((r) => {
          const current = r.revision === v.current_revision;
          return html`<li data-pf-version=${r.revision ?? ''}>
            <b>${pft('revision', { n: r.revision ?? '?' })}</b>
            ${current ? html`<sw-badge kind="live" label=${pft('versionCurrent')}></sw-badge>` : nothing}
            <span class="muted">${r.saved_at ? new Date(r.saved_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : pft('versionBaseline')}</span>
            <span>${pftDynamic(`versionAction_${r.action ?? ''}`, 'versionAction_system')}</span>
            <span class="muted">${pft('versionChanges', { f: r.field_changes ?? 0, g: r.group_changes ?? 0 })}</span>
            ${!current && canCompare && r.revision !== null
              ? html`<span class="acts"><sw-button size="sm" variant="secondary" data-pf-compare=${r.revision} @click=${() => void this.compareWith(r.revision as number)}>${pft('compareWith')}</sw-button>
                  <sw-button size="sm" variant="ghost" icon="history" data-pf-rollback=${r.revision} @click=${() => void this.loadRollback(r.revision as number)}>${pft('rollback')}</sw-button></span>`
              : nothing}
          </li>`;
        })}</ul>
        <div class="row-inline">
          ${v.previous_offset !== null ? html`<sw-button size="sm" variant="ghost" @click=${() => void this.loadVersions(v.previous_offset as number)}>${pft('newerVersions')}</sw-button>` : nothing}
          ${v.next_offset !== null ? html`<sw-button size="sm" variant="ghost" @click=${() => void this.loadVersions(v.next_offset as number)}>${pft('olderVersions')}</sw-button>` : nothing}
        </div>
      </section>
      ${this.compareError ? html`<p class="note err" role="alert" data-pf-compare-error>${this.compareError}</p>` : nothing}
      ${this.compare
        ? html`<section class="card" data-pf-compare-panel><header><h2>${pft('compareTitle', { a: this.compare.before_revision ?? '', b: this.compare.after_revision ?? '' })}</h2></header>
            ${this.compare.rows.length ? this.diffList(this.compare.rows) : html`<p class="muted">${pft('compareEmpty')}</p>`}</section>`
        : nothing}
    </div>`;
  }

  private renderSuggest(): TemplateResult {
    if (this.view?.features.suggestions.available === false) return html`<p class="note warn" data-pf-suggest-unsupported>${pft('partUnsupported')}</p>`;
    const s = this.suggest;
    return html`<div class="stack" data-pf-suggest>
      <section class="card"><header><h2>${pft('suggestTitle')}</h2><span class="muted">${pft('suggestHint')}</span></header>
        <form class="row-inline" @submit=${(e: Event) => (e.preventDefault(), void this.searchPeople())}>
          <label class="f grow"><span>${pft('suggestSearch')}</span><input type="search" .value=${this.peopleQuery} placeholder=${pft('suggestSearchPh')} data-pf-people-q
            @input=${(e: Event) => (this.peopleQuery = (e.target as HTMLInputElement).value)} /></label>
          <sw-button type="submit" variant="secondary" icon="search" data-pf-people-search @click=${() => void this.searchPeople()}>${pft('suggestSearch')}</sw-button>
        </form>
        ${this.people.length
          ? html`<div class="chips" role="listbox" aria-label=${pft('suggestSearch')}>${this.people.map((p) => html`<button type="button" role="option" class="chip ${this.person?.id === p.id ? 'on' : ''}"
              aria-selected=${String(this.person?.id === p.id)} data-pf-pick=${p.id} @click=${() => void this.pickPerson(p)}>${p.display_name}</button>`)}</div>`
          : nothing}
        ${this.suggestError ? html`<p class="note err" role="alert" data-pf-suggest-error>${this.suggestError}</p>` : nothing}
      </section>
      ${s && this.person
        ? html`<section class="card" data-pf-suggest-result><header><h2>${this.person.display_name}</h2></header>
            ${s.fields.length
              ? html`<fieldset class="chips"><legend class="muted">${pft('suggestFields')}</legend>${s.fields.map((f) => {
                  const on = this.suggestFields.includes(f.id);
                  return html`<label class="ck chip ${on ? 'on' : ''}"><input type="checkbox" .checked=${on} data-pf-suggest-field=${f.id}
                    ?disabled=${!on && this.suggestFields.length >= SUGGEST_FIELDS_MAX}
                    @change=${(e: Event) => {
                      const c = (e.target as HTMLInputElement).checked;
                      this.suggestFields = c ? [...this.suggestFields, f.id] : this.suggestFields.filter((x) => x !== f.id);
                    }} /> ${f.label}: ${f.value ?? pft('suggestValueHidden')}</label>`;
                })}
                <sw-button variant="primary" ?disabled=${!this.suggestFields.length} data-pf-suggest-run @click=${() => void this.runSuggest()}>${pft('suggestRun')}</sw-button></fieldset>`
              : html`<p class="muted">${pft('suggestNoFields')}</p>`}
            ${this.suggestFields.length && !s.suggestions.length ? html`<p class="muted" data-pf-suggest-none>${pft('suggestNone')}</p>` : nothing}
            <ul class="people">${s.suggestions.map((g) => html`<li data-pf-suggestion=${g.group_id}><b>${g.label}</b>
              <span class="muted">${pft('suggestMembers', { n: g.matching_members, m: g.matching_people })}</span>
              <span>${pft('suggestDoors')}: ${g.doors.map((d) => `${d.station_name}${d.blocked ? ` (${pft('suggestBlocked')})` : ''}`).join(', ')}</span></li>`)}</ul>
            <a class="link" href=${`#/wiskey/people?person=${encodeURIComponent(this.person.id)}`} data-pf-open-person>${pft('suggestOpenPerson')}</a>
          </section>`
        : nothing}
    </div>`;
  }

  static styles = css`
    :host { display: block; }
    .stack { display: grid; gap: 14px; }
    .tabs { display: inline-flex; gap: 2px; padding: 3px; margin-block-end: 14px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); border: 1px solid var(--sw-border);
      max-inline-size: 100%; overflow-x: auto; }
    .tabs button { font: inherit; font-size: var(--sw-fs-sm); padding: 6px 14px; border: 0; border-radius: calc(var(--sw-r-md) - 2px); background: transparent; color: var(--sw-text-2); cursor: pointer;
      white-space: nowrap; min-block-size: 36px; }
    .tabs button.on { background: var(--sw-seg-key, var(--sw-surface)); color: var(--sw-seg-key-ink, var(--sw-text)); font-weight: 600; box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
    .tabs button:focus-visible, .chip:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 2px; }
    .bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface);
      border: 1px solid var(--sw-border); position: sticky; inset-block-start: 0; z-index: 2; }
    .bar-text { display: grid; gap: 2px; min-inline-size: 0; }
    .bar-acts { display: flex; flex-wrap: wrap; gap: 8px; }
    .card { display: grid; gap: 10px; padding: 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); min-inline-size: 0; }
    .card header { display: grid; gap: 2px; }
    h2 { margin: 0; font-size: var(--sw-fs-lg); font-weight: 700; color: var(--sw-text); }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .note { margin: 0; padding: 10px 12px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); font-size: var(--sw-fs-sm); }
    .note ul { margin: 6px 0 0; padding-inline-start: 18px; }
    .note.warn { border-color: var(--sw-warning); background: var(--sw-warning-soft); }
    .note.err { border-color: var(--sw-danger); background: var(--sw-danger-soft); }
    .item { display: grid; gap: 8px; padding: 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface-2); min-inline-size: 0; }
    .item.off { opacity: 0.72; }
    .item-top { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .item-top .lbl { flex: 1 1 14em; min-inline-size: 0; }
    .moves { display: inline-flex; gap: 2px; margin-inline-start: auto; align-items: center; }
    .mv { font: inherit; inline-size: 34px; block-size: 34px; border-radius: var(--sw-r-sm); border: 1px solid transparent; background: transparent; color: var(--sw-text-2); cursor: pointer; }
    .mv:hover:not([disabled]) { border-color: var(--sw-border); color: var(--sw-text); }
    .mv[disabled] { opacity: 0.35; cursor: default; }
    .mv:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 2px; }
    input[type='text'], input[type='search'], select, textarea { font: inherit; font-size: 1rem; color: var(--sw-text); background: var(--sw-surface); border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm); padding: 7px 10px; min-block-size: 38px; inline-size: 100%; box-sizing: border-box; }
    textarea { min-block-size: 76px; resize: vertical; }
    .grid { display: grid; gap: 8px 12px; grid-template-columns: repeat(auto-fit, minmax(10em, 1fr)); align-items: end; }
    .f { display: grid; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; }
    .f.wide { grid-column: 1 / -1; }
    .f.grow { flex: 1 1 14em; }
    .ck { display: inline-flex; gap: 6px; align-items: center; font-size: var(--sw-fs-sm); min-block-size: 38px; }
    .row-inline { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; border: 0; padding: 0; margin: 0; min-inline-size: 0; }
    .chip { font: inherit; font-size: var(--sw-fs-sm); padding: 5px 12px; min-block-size: 32px; border-radius: 999px; border: 1px solid var(--sw-border); background: var(--sw-surface);
      color: var(--sw-text); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
    .chip.on { background: var(--sw-accent-soft); border-color: var(--sw-accent); color: var(--sw-accent-text); font-weight: 600; }
    .chip.unknown { border-style: dashed; }
    .chip[disabled] { opacity: 0.5; cursor: not-allowed; }
    .chip .dot { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--sw-text-3); }
    .problem { color: var(--sw-danger); font-size: var(--sw-fs-sm); }
    .sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .diff, .people, .versions { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .diff li, .people li, .versions li { padding: 8px 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center;
      min-inline-size: 0; overflow-wrap: anywhere; }
    .diff li { display: grid; }
    .diff-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .diff dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 2px 10px; font-size: var(--sw-fs-sm); }
    .diff dt { color: var(--sw-text-2); }
    .diff dd { margin: 0; }
    .before { text-decoration: line-through; color: var(--sw-text-2); }
    .after { font-weight: 600; }
    .people li.changed { border-color: var(--sw-accent); }
    .gain { color: var(--sw-success); font-size: var(--sw-fs-sm); }
    .lose { color: var(--sw-danger); font-size: var(--sw-fs-sm); }
    .warn-t { color: var(--sw-warning); font-size: var(--sw-fs-sm); }
    .err-t { color: var(--sw-danger); font-size: var(--sw-fs-sm); font-weight: 600; }
    .fi { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; padding-block: 4px; border-block-end: 1px solid var(--sw-border); }
    .fi .ex { flex-basis: 100%; }
    .kv { display: grid; gap: 4px; }
    .count { font-weight: 700; }
    .versions .acts { display: inline-flex; gap: 6px; margin-inline-start: auto; }
    .result.ok { border-color: var(--sw-success); }
    .result.warn { border-color: var(--sw-warning); }
    .result.err { border-color: var(--sw-danger); }
    .result p { margin: 0; }
    .dlg-acts { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .link { color: var(--sw-accent); font-size: var(--sw-fs-sm); }
    @media (max-width: 640px) {
      .bar { position: static; }
      .bar-acts { inline-size: 100%; }
      .bar-acts sw-button { flex: 1 1 auto; }
      .tabs { display: flex; }
      .tabs button { flex: 1 1 auto; }
    }
    @media (prefers-reduced-motion: no-preference) {
      .chip, .tabs button { transition: background-color 120ms ease-out, border-color 120ms ease-out; }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-profiles-screen': WiskeyProfilesScreen;
  }
}

