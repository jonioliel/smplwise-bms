import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-state-panel';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { ticketsRulesApi } from '../api/tickets-rules';
import { ticketSettingsCss } from './settings-styles';
import {
  blankDraft, draftOf, limitProblem, parseWhole, ruleBody, ruleProblems, serverProblems, sourceLabel, stored,
  type DryRunAnswer, type RuleDraft, type RuleField, type RuleProblem, type RulesDoc, type TicketRule, type TicketRuleView,
} from './rules-model';
import { rlt, type RulesTextKey } from './rules-text';

const PROBLEM_TEXT: Record<RuleProblem, RulesTextKey> = {
  required: 'err_required', too_long: 'err_too_long', placeholder: 'err_placeholder', range: 'err_range', integer: 'err_integer',
  unknown: 'err_unknown', choice: 'err_choice',
};

/**
 * TKRULES-291: Settings › service management › "פתיחה אוטומטית" (system.configure). The global switch (the kill switch), the
 * installation's daily maximum per rule, the rule list (source, department, the effective daily limit, today's count and a "limit
 * reached today" chip, enable / disable), one inline editor (new or existing) and "בדיקת כלל" - the server's dry run of the rule as
 * typed, which writes nothing. Every save is the whole document with its revision (a 409 reloads). Events: `notice` {ok | error}.
 */
@customElement('tickets-rules-settings')
export class TicketsRulesSettings extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private doc: RulesDoc | null = null;
  @state() private failed = '';
  @state() private forbidden = false;
  @state() private busy = false;
  /** the open editor: 'new', a rule id, or '' (closed) */
  @state() private editing = '';
  @state() private draft: RuleDraft | null = null;
  @state() private tried = false;
  @state() private serverErr: Partial<Record<RuleField, RuleProblem>> = {};
  @state() private limitText = '';
  @state() private limitTried = false;
  /** the dry run on screen: for which rule ('new' or an id) and its answer */
  @state() private dryFor = '';
  @state() private dry: DryRunAnswer | null = null;

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .rule {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .rule .txt {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1 1 240px;
      min-inline-size: 0;
    }
    .rule .txt small {
      color: var(--sw-text-3);
      overflow-wrap: anywhere;
    }
    .rule[data-off] .txt b {
      color: var(--sw-text-3);
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      font-size: var(--sw-fs-xs);
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .chip.warn {
      background: var(--sw-warning-soft, var(--sw-surface-2));
      color: var(--sw-warning-text, var(--sw-warning, var(--sw-text)));
    }
    .chip.bad {
      color: var(--sw-danger);
    }
    .editor {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .editor .wide {
      grid-column: 1 / -1;
    }
    .editor .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .editor .checks {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: center;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .dry {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      margin-block: 6px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .dry b[data-dry-would] {
      font-size: var(--sw-fs-md, var(--sw-fs-sm));
    }
    .dry .pv {
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      white-space: pre-line;
      overflow-wrap: anywhere;
    }
    .dry small {
      color: var(--sw-text-3);
    }
    @media (max-width: 640px) {
      .editor {
        grid-template-columns: minmax(0, 1fr);
      }
      .rule .acts {
        inline-size: 100%;
      }
    }
  `, bubbleChrome];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  private async load(): Promise<void> {
    this.failed = '';
    try {
      this.take(await ticketsRulesApi().load());
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.forbidden = true;
      else this.failed = describeError(e);
    }
  }

  private take(d: RulesDoc): void {
    this.doc = d;
    this.limitText = String(d.daily_limit_default);
    this.limitTried = false;
  }

  /** Save the whole document: `rules` replaces the list (the editor's rule at `index` gets the server's field problems). */
  private async saveDoc(rules: TicketRule[], opts: { enabled?: boolean; daily?: number; index?: number | null; ok: RulesTextKey }): Promise<boolean> {
    const d = this.doc;
    if (!d) return false;
    this.busy = true;
    try {
      this.take(await ticketsRulesApi().save({ revision: d.revision, enabled: opts.enabled ?? d.enabled, daily_limit_default: opts.daily ?? d.daily_limit_default, rules }));
      this.notice({ ok: rlt(opts.ok) });
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'rules_stale') {
        await this.load();
        this.notice({ error: rlt('stale') });
      } else if (e instanceof ApiError && e.status === 422) {
        const fields = (e.body.details?.fields ?? []) as { field: string; code: string }[];
        this.serverErr = serverProblems(fields, opts.index ?? null);
        if (!Object.keys(this.serverErr).length) this.notice({ error: describeError(e) });
      } else {
        this.notice({ error: describeError(e) });
      }
      return false;
    } finally {
      this.busy = false;
    }
  }

  private current(): TicketRule[] {
    return (this.doc?.rules ?? []).map(stored);
  }

  private open(id: string): void {
    const d = this.doc;
    if (!d) return;
    const r = d.rules.find((x) => x.id === id);
    this.editing = id;
    this.draft = r ? draftOf(r) : blankDraft(d.sources, d.departments);
    this.tried = false;
    this.serverErr = {};
    this.closeDry();
  }

  private close(): void {
    this.editing = '';
    this.draft = null;
    this.closeDry();
  }

  private set<K extends keyof RuleDraft>(k: K, v: RuleDraft[K]): void {
    if (!this.draft) return;
    const next = { ...this.draft, [k]: v };
    if (k === 'department_id') {
      next.priority_id = '';
      next.category_id = '';
    }
    this.draft = next;
    this.serverErr = {};
  }

  private problems(): Partial<Record<RuleField, RuleProblem>> {
    if (!this.draft || !this.doc) return {};
    return { ...ruleProblems(this.draft, this.doc), ...this.serverErr };
  }

  private async saveRule(): Promise<void> {
    this.tried = true;
    if (!this.draft || Object.keys(this.problems()).length) return;
    const body = ruleBody(this.draft);
    const rules = this.current();
    let index = rules.findIndex((r) => r.id === this.editing);
    if (index < 0) {
      rules.push({ ...body, id: null });
      index = rules.length - 1;
    } else {
      rules[index] = body;
    }
    if (await this.saveDoc(rules, { index, ok: 'saved' })) this.close();
  }

  private async toggleRule(r: TicketRuleView): Promise<void> {
    await this.saveDoc(this.current().map((x) => (x.id === r.id ? { ...x, enabled: !r.enabled } : x)), { ok: 'saved' });
  }

  private async removeRule(r: TicketRuleView): Promise<void> {
    if (!window.confirm(rlt('confirmRemove', { name: r.name }))) return;
    if (await this.saveDoc(this.current().filter((x) => x.id !== r.id), { ok: 'removed' }) && this.editing === r.id) this.close();
  }

  private async setMaster(on: boolean): Promise<void> {
    await this.saveDoc(this.current(), { enabled: on, ok: 'saved' });
  }

  private async saveLimit(): Promise<void> {
    this.limitTried = true;
    const d = this.doc;
    if (!d || limitProblem(this.limitText, d.bounds.hard_daily_max, false)) return;
    await this.saveDoc(this.current(), { daily: parseWhole(this.limitText) ?? d.daily_limit_default, ok: 'saved' });
  }

  private async test(forId: string, rule: TicketRule): Promise<void> {
    this.busy = true;
    try {
      this.dry = await ticketsRulesApi().test(rule);
      this.dryFor = forId;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && this.draft) {
        this.tried = true;
        this.serverErr = serverProblems((e.body.details?.fields ?? []) as { field: string; code: string }[], null);
      } else {
        this.notice({ error: describeError(e) });
      }
    } finally {
      this.busy = false;
    }
  }

  private testDraft(): void {
    this.tried = true;
    if (!this.draft || Object.keys(this.problems()).length) return;
    void this.test(this.editing, ruleBody(this.draft));
  }

  private closeDry(): void {
    this.dry = null;
    this.dryFor = '';
  }

  // ---------------------------------------------------------------- render

  private err(p: Partial<Record<RuleField, RuleProblem>>, f: RuleField): TemplateResult | typeof nothing {
    const code = p[f];
    return (this.tried || this.serverErr[f]) && code ? html`<span class="err" role="alert" data-rule-err=${f}>${rlt(PROBLEM_TEXT[code])}</span>` : nothing;
  }

  private dryPanel(): TemplateResult | typeof nothing {
    const a = this.dry;
    if (!a) return nothing;
    const would = `would_${a.would}` as RulesTextKey;
    return html`<div class="dry" role="status" data-rule-dry=${this.dryFor} data-dry-outcome=${a.would}>
      <div><small>${rlt('dryTitle')}</small></div>
      <div><b data-dry-would>${rlt(would)}</b></div>
      <div><small>${a.matches ? rlt('dryMatches', { n: a.matches, held: a.held }) : rlt('dryNone')}</small></div>
      ${a.alerts.length ? html`<div><small data-dry-alerts>${a.alerts.map((x) => bidi([x.title, x.place].filter(Boolean).join(' · '))).join(' | ')}</small></div>` : nothing}
      ${a.sample_values ? html`<div><small data-dry-sample>${rlt('drySample')}</small></div>` : nothing}
      <div><small>${rlt('dryPreview')}</small></div>
      <div class="pv" data-dry-preview><b>${bidi(a.preview.title)}</b>${a.preview.description ? html`<br />${bidi(a.preview.description)}` : nothing}</div>
      <div><small>${rlt('dryDept')}: ${bidi(a.preview.department)} · ${rlt('dryPriority')}: ${bidi(a.preview.priority)} · ${rlt('dryLimit', { today: a.today_created, limit: a.effective_limit })}</small></div>
      <div><sw-button size="sm" data-dry-close @click=${() => this.closeDry()}>${rlt('dryClose')}</sw-button></div>
    </div>`;
  }

  private editor(d: RulesDoc): TemplateResult {
    const r = this.draft!;
    const p = this.problems();
    const inv = (f: RuleField) => String(!!((this.tried || this.serverErr[f]) && p[f]));
    const dept = d.departments.find((x) => x.id === r.department_id);
    const sources = d.sources.some((s) => s.key === r.source) ? d.sources : [{ key: r.source, label: rlt('sourceGone'), category: '', subject: '' }, ...d.sources];
    const onSel = (k: keyof RuleDraft) => (e: Event) => this.set(k, (e.target as HTMLSelectElement).value as never);
    const onIn = (k: keyof RuleDraft) => (e: Event) => this.set(k, (e.target as HTMLInputElement).value as never);
    return html`<div class="editor" data-rule-editor=${this.editing}>
      <label class="fld wide">${rlt('fName')}<input class="in" data-rule-field="name" maxlength=${d.bounds.name_max} aria-invalid=${inv('name')} .value=${r.name}
        @input=${onIn('name')} />${this.err(p, 'name')}</label>
      <label class="fld">${rlt('fSource')}<select class="in" data-rule-field="source" aria-invalid=${inv('source')} @change=${onSel('source')}>
        ${sources.map((s) => html`<option value=${s.key} ?selected=${s.key === r.source}>${s.label}</option>`)}</select>${this.err(p, 'source')}</label>
      <label class="fld">${rlt('fHold')}<input class="in num" inputmode="numeric" dir="ltr" data-rule-field="hold_min" aria-invalid=${inv('hold_min')} .value=${r.hold_min}
        @input=${onIn('hold_min')} />${this.err(p, 'hold_min')}</label>
      <label class="fld wide">${rlt('fSubject')}<input class="in" dir="ltr" data-rule-field="subject_id" maxlength="200" placeholder=${rlt('fSubjectPh')}
        aria-invalid=${inv('subject_id')} .value=${r.subject_id} @input=${onIn('subject_id')} />${this.err(p, 'subject_id')}</label>
      <label class="fld">${rlt('fDept')}<select class="in" data-rule-field="department_id" aria-invalid=${inv('department_id')} @change=${onSel('department_id')}>
        ${dept ? nothing : html`<option value="" selected>—</option>`}
        ${d.departments.map((x) => html`<option value=${x.id} ?selected=${x.id === r.department_id}>${bidi(x.name)}</option>`)}</select>${this.err(p, 'department_id')}</label>
      <label class="fld">${rlt('fPriority')}<select class="in" data-rule-field="priority_id" aria-invalid=${inv('priority_id')} @change=${onSel('priority_id')}>
        <option value="" ?selected=${!r.priority_id}>${rlt('fPriorityDefault')}</option>
        ${(dept?.priorities ?? []).map((x) => html`<option value=${x.id} ?selected=${x.id === r.priority_id}>${bidi(x.name)}</option>`)}</select>${this.err(p, 'priority_id')}</label>
      ${dept?.categories.length ? html`<label class="fld">${rlt('fCategory')}<select class="in" data-rule-field="category_id" aria-invalid=${inv('category_id')} @change=${onSel('category_id')}>
        <option value="" ?selected=${!r.category_id}>${rlt('fCategoryNone')}</option>
        ${dept.categories.map((x) => html`<option value=${x.id} ?selected=${x.id === r.category_id}>${bidi(x.name)}</option>`)}</select>${this.err(p, 'category_id')}</label>` : nothing}
      <label class="fld">${rlt('fLimit')}<input class="in num" inputmode="numeric" dir="ltr" data-rule-field="daily_limit" placeholder=${rlt('fLimitPh', { n: d.daily_limit_default })}
        aria-invalid=${inv('daily_limit')} .value=${r.daily_limit} @input=${onIn('daily_limit')} />${this.err(p, 'daily_limit')}</label>
      <label class="fld wide">${rlt('fTitle')}<input class="in" data-rule-field="title" maxlength=${d.bounds.title_max} aria-invalid=${inv('title')} .value=${r.title}
        @input=${onIn('title')} />${this.err(p, 'title')}</label>
      <label class="fld wide">${rlt('fDescription')}<textarea class="in" data-rule-field="description" maxlength=${d.bounds.description_max} aria-invalid=${inv('description')}
        .value=${r.description} @input=${onIn('description')}></textarea>${this.err(p, 'description')}<span class="hint" data-rule-placeholders>${rlt('fPlaceholders')} <span dir="ltr">${d.bounds.placeholders.map((x) => `{${x}}`).join(' ')}</span></span></label>
      <label class="fld wide">${rlt('fOnClear')}<select class="in" data-rule-field="on_clear" @change=${onSel('on_clear')}>
        <option value="comment" ?selected=${r.on_clear === 'comment'}>${rlt('onClearComment')}</option>
        <option value="comment_close" ?selected=${r.on_clear === 'comment_close'}>${rlt('onClearClose')}</option></select></label>
      <div class="checks wide"><label><input type="checkbox" data-rule-field="enabled" .checked=${r.enabled}
        @change=${(e: Event) => this.set('enabled', (e.target as HTMLInputElement).checked)} /> ${rlt('fEnabled')}</label></div>
      <div class="acts wide">
        <sw-button size="sm" variant="primary" data-rule-save ?disabled=${this.busy} @click=${() => void this.saveRule()}>${rlt('save')}</sw-button>
        <sw-button size="sm" data-rule-test-draft ?disabled=${this.busy} @click=${() => this.testDraft()}>${rlt('test')}</sw-button>
        <sw-button size="sm" data-rule-cancel ?disabled=${this.busy} @click=${() => this.close()}>${rlt('cancel')}</sw-button>
      </div>
      ${this.dryFor === this.editing ? html`<div class="wide">${this.dryPanel()}</div>` : nothing}
    </div>`;
  }

  private row(d: RulesDoc, r: TicketRuleView): TemplateResult {
    if (this.editing === r.id) return this.editor(d);
    const dept = d.departments.find((x) => x.id === r.department_id);
    const src = sourceLabel(d.sources, r.source) || rlt('sourceGone');
    const perDay = r.daily_limit == null ? rlt('perDayDefault', { n: r.effective_limit }) : rlt('perDay', { n: r.effective_limit });
    return html`<div class="rule" data-rule=${r.id} ?data-off=${!r.enabled || !d.enabled}>
      <span class="txt"><b>${bidi(r.name)}
        ${!r.enabled ? html`<span class="chip" data-rule-disabled>${rlt('disabledChip')}</span>` : nothing}
        ${r.invalid ? html`<span class="chip bad" data-rule-invalid>${rlt('invalidChip')}</span>` : nothing}
        ${r.limit_reached ? html`<span class="chip warn" data-rule-limit-reached>${rlt('limitReached')}</span>` : nothing}</b>
        <small>${src} · ${bidi(dept?.name ?? '—')}</small>
        <small><span data-rule-limit>${perDay}</span> · <span data-rule-today>${rlt('today', { n: r.today_created })}</span></small></span>
      <span class="acts">
        <sw-button size="sm" data-rule-edit=${r.id} ?disabled=${this.busy || !!this.editing} @click=${() => this.open(r.id)}>${rlt('edit')}</sw-button>
        <sw-button size="sm" data-rule-test=${r.id} ?disabled=${this.busy || !!this.editing || !!r.invalid} @click=${() => void this.test(r.id, stored(r))}>${rlt('test')}</sw-button>
        <sw-button size="sm" data-rule-toggle=${r.id} ?disabled=${this.busy || !!this.editing} @click=${() => void this.toggleRule(r)}>${r.enabled ? rlt('disable') : rlt('enable')}</sw-button>
        <sw-button size="sm" data-rule-remove=${r.id} ?disabled=${this.busy || !!this.editing} @click=${() => void this.removeRule(r)}>${rlt('remove')}</sw-button>
      </span>
    </div>
    ${this.dryFor === r.id ? this.dryPanel() : nothing}`;
  }

  render() {
    if (this.forbidden) return html`<sw-state-panel state="forbidden"></sw-state-panel>`;
    if (this.failed) return html`<sw-state-panel state="error" heading=${this.failed}><sw-button size="sm" @click=${() => void this.load()}>${rlt('retry')}</sw-button></sw-state-panel>`;
    const d = this.doc;
    if (!d) return html`<sw-state-panel state="loading" heading=${rlt('loading')}></sw-state-panel>`;
    const limitErr = this.limitTried ? limitProblem(this.limitText, d.bounds.hard_daily_max, false) : null;
    const full = d.rules.length >= d.bounds.max_rules;
    return html`<sw-card heading=${rlt('title')} subheading=${rlt('sub')} data-card="ticket-rules-settings">
      <div class="row"><span class="lbl">${rlt('master')}<span class="muted">${rlt('masterSub')}</span></span>
        <span class="end"><sw-toggle label=${rlt('master')} labelHidden .checked=${d.enabled} ?disabled=${this.busy} data-rules-master
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.setMaster(e.detail.checked)}></sw-toggle></span></div>
      <div class="row"><span class="lbl">${rlt('defaultLimit')}<span class="muted">${rlt('defaultLimitSub', { max: d.bounds.hard_daily_max })}</span></span>
        <span class="end"><input class="in num" inputmode="numeric" dir="ltr" data-rules-default-limit aria-label=${rlt('defaultLimit')}
          aria-invalid=${String(!!limitErr)} .value=${this.limitText} @input=${(e: Event) => (this.limitText = (e.target as HTMLInputElement).value)} />
          <sw-button size="sm" data-rules-default-save ?disabled=${this.busy || this.limitText === String(d.daily_limit_default)}
            @click=${() => void this.saveLimit()}>${rlt('saveSettings')}</sw-button>
          ${limitErr ? html`<span class="err" role="alert" data-rules-default-err>${rlt(PROBLEM_TEXT[limitErr])}</span>` : nothing}</span></div>
    </sw-card>
    <sw-card data-card="ticket-rules">
      ${d.rules.length || this.editing === 'new' ? nothing : html`<div class="row" data-rules-empty><span class="lbl">${rlt('empty')}</span></div>`}
      ${repeat(d.rules, (r) => r.id, (r) => this.row(d, r))}
      ${this.editing === 'new' ? this.editor(d) : html`<div class="row"><sw-button size="sm" data-rule-add ?disabled=${this.busy || !!this.editing || full || !d.departments.length}
        @click=${() => this.open('new')}>${rlt('add')}</sw-button></div>`}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-rules-settings': TicketsRulesSettings;
  }
}
