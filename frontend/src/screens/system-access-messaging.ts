import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-card';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import {
  getMessagingSettings,
  isSettingsConflict,
  putMessagingSettings,
  settingsProblems as serverProblems,
  type MessagingSettingsDoc,
  type MessagingSettingsReply,
  type SettingsProblem,
} from '../api/access-messaging';
import { insertAt, problemsAt, settingsProblems, DEFAULT_LIMITS } from '../access-control/messaging-templates';
import { statusStyles } from '../access-control/status-css';
import { failurePanel, skeletonRows } from '../access-control/status-panel';
import { bubbleChrome } from '../styles/bubble-chrome';
import { mt, problemText, type MessagingKey } from '../i18n/access-messaging';

/** WA-CONSENT-LINK: the consent request's languages (the server's CONSENT_LANGS) and the words of "the page cannot serve a link". */
const CONSENT_LANGS = ['he', 'en', 'ar', 'ru'] as const;
const consentProblemKey = (problem: string): MessagingKey =>
  problem === 'module_off' ? 'consent.problem.module_off' : problem === 'key' ? 'consent.problem.key' : 'consent.problem.public_page';

/** One template as the editor holds it: the saved id (none for a new one) and a key that keeps the row stable while it is edited. */
interface Row {
  key: string;
  id?: string;
  label: string;
  body: string;
}

/** The whole document as the form holds it (numbers as the text of their fields, so a half-typed number is not lost). */
interface Draft {
  revision: number;
  enabled: boolean;
  free_text: boolean;
  bulk_max: string;
  rate_per_hour: string;
  organization: string;
  account: string;
  templates: Row[];
  // WA-CONSENT-LINK
  consent_by_link: boolean;
  consent_wait_days: string;
  consent_language: string;
  consent_wa_template: string;
  consent_wa_language: string;
}

let rowKey = 0;
const nextKey = () => `r${++rowKey}`;

/** A sentence that names the templates' own placeholders ({name}, {organization}) with each placeholder set as a left-to-right isolate, so
 * the braces and the word keep their order inside a right-to-left line. */
function withPlaceholders(text: string): TemplateResult {
  return html`${text.split(/(\{[a-z]+\})/).map((part) => (/^\{[a-z]+\}$/.test(part) ? html`<bdi class="ltr">${part}</bdi>` : part))}`;
}

const toDraft = (d: MessagingSettingsDoc): Draft => ({
  revision: d.revision,
  enabled: d.enabled,
  free_text: d.free_text,
  bulk_max: String(d.bulk_max),
  rate_per_hour: String(d.rate_per_hour),
  organization: d.organization,
  account: d.account,
  templates: d.templates.map((t) => ({ key: nextKey(), id: t.id, label: t.label, body: t.body })),
  consent_by_link: d.consent_by_link === true,
  consent_wait_days: String(d.consent_wait_days ?? 7),
  consent_language: d.consent_language ?? 'he',
  consent_wa_template: d.consent_wa_template ?? '',
  consent_wa_language: d.consent_wa_language ?? '',
});

/** The document the form means (a field that is not a whole number stays NaN: a `type` problem, not a silent 0). */
const toDoc = (d: Draft): MessagingSettingsDoc => ({
  revision: d.revision,
  enabled: d.enabled,
  free_text: d.free_text,
  bulk_max: /^\d+$/.test(d.bulk_max.trim()) ? Number(d.bulk_max) : Number.NaN,
  rate_per_hour: /^\d+$/.test(d.rate_per_hour.trim()) ? Number(d.rate_per_hour) : Number.NaN,
  organization: d.organization,
  account: d.account,
  templates: d.templates.map((t) => ({ ...(t.id ? { id: t.id } : {}), label: t.label, body: t.body })),
  consent_by_link: d.consent_by_link,
  consent_wait_days: /^\d+$/.test(d.consent_wait_days.trim()) ? Number(d.consent_wait_days) : Number.NaN,
  consent_language: d.consent_language,
  consent_wa_template: d.consent_wa_template.trim(),
  consent_wa_language: d.consent_wa_language.trim(),
});

const snapshot = (d: Draft): string =>
  JSON.stringify([d.enabled, d.free_text, d.bulk_max.trim(), d.rate_per_hour.trim(), d.organization.trim(), d.account, d.templates.map((t) => [t.id ?? '', t.label.trim(), t.body.trim()]),
    d.consent_by_link, d.consent_wait_days.trim(), d.consent_language, d.consent_wa_template.trim(), d.consent_wa_language.trim()]);

/**
 * CR-036 WA: "הודעות" - the fifth segment of the Settings page "בקרת כניסה" (system.configure): the administrator's switch for sending
 * WhatsApp messages from the people screen (off until turned on - the messaging service has not been proven against a real installation),
 * whether a sender may write a free text, how many people one run may reach and how many messages go out in an hour, the organization's
 * name, and the approved TEMPLATES (add, edit, delete). One form, one save: the whole document is checked by the server (a problem comes
 * back per field), a stale save is a conflict, never an overwrite. Nothing else is stored here: a message's text is never kept anywhere.
 */
@customElement('system-access-messaging')
export class SystemAccessMessaging extends LitElement {
  /** The page's refresh counter: a change reads the settings again. */
  @property({ type: Number }) rev = 0;
  @state() private reply: MessagingSettingsReply | null = null;
  @state() private draft: Draft | null = null;
  @state() private base = '';
  @state() private loading = true;
  @state() private failed = '';
  @state() private saving = false;
  @state() private notice: '' | 'saved' | 'conflict' | 'failed' = '';
  @state() private noticeText = '';
  @state() private submitted = false;
  @state() private touched: ReadonlySet<string> = new Set();
  @state() private remote: SettingsProblem[] = [];
  private lastRev = 0;
  private gen = 0;

  static styles = [
    statusStyles,
    css`
      .sw {
        display: flex;
        align-items: center;
        gap: 14px;
        inline-size: 100%;
        min-block-size: max(64px, var(--_t));
        padding: 10px 14px;
        box-sizing: border-box;
        border: 0;
        border-block-start: 1px solid var(--sw-border);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .sw:disabled {
        cursor: default;
        opacity: var(--sw-disabled-opacity);
      }
      .sw:not(:disabled):hover {
        background: var(--sw-hover-wash);
      }
      .sw:focus-visible {
        outline-offset: -2px;
      }
      .sw .txt {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sw .t {
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
      }
      .sw .x {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .track {
        flex: none;
        position: relative;
        inline-size: 42px;
        block-size: 24px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-border-strong);
        transition: background var(--sw-t-fast) var(--sw-ease);
      }
      .track::after {
        content: '';
        position: absolute;
        inset-block-start: 3px;
        inset-inline-start: 3px;
        inline-size: 18px;
        block-size: 18px;
        border-radius: 50%;
        background: var(--sw-toggle-thumb);
        box-shadow: var(--sw-shadow-1);
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
      .sw[aria-checked='true'] .track {
        background: var(--sw-toggle-on);
      }
      .sw[aria-checked='true'] .track::after {
        transform: translateX(-18px);
      }
      :host-context([dir='ltr']) .sw[aria-checked='true'] .track::after {
        transform: translateX(18px);
      }
      @media (prefers-reduced-motion: reduce) {
        .track,
        .track::after {
          transition: none;
        }
      }
      .svc {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px 12px;
        color: var(--sw-text-2);
        font-size: var(--sw-fs-sm);
      }
      .fields {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        padding: 14px;
        border-block-start: 1px solid var(--sw-border);
      }
      @media (max-width: 900px) {
        .fields {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .tpl {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        border-block-start: 1px solid var(--sw-border);
      }
      .tpl-head {
        display: flex;
        align-items: flex-end;
        gap: 10px;
      }
      .tpl-head sw-field {
        flex: 1;
        min-inline-size: 0;
      }
      .tpl-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px 12px;
      }
      .tpl-foot .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .hint {
        margin-block-start: 6px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
      }
      .ltr {
        direction: ltr;
        unicode-bidi: isolate;
      }
      .cnt {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        font-variant-numeric: tabular-nums;
      }
      input,
      textarea,
      select {
        font: inherit;
      }
      textarea {
        min-block-size: 96px;
        resize: vertical;
        line-height: 1.5;
      }
      .problem {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--sw-danger-text);
        font-size: var(--sw-fs-sm);
      }
      sw-field[data-bad] ::slotted(input),
      sw-field[data-bad] ::slotted(textarea),
      sw-field[data-bad] ::slotted(select) {
        border-color: var(--sw-danger);
      }
      .actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px 12px;
        justify-content: flex-end;
      }
      .actions .grow {
        flex: 1 1 14rem;
        min-inline-size: 0;
      }
      sw-button {
        min-block-size: var(--_t);
      }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    this.gen += 1;
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('rev') && this.rev !== this.lastRev) {
      this.lastRev = this.rev;
      void this.load();
    }
  }

  private async load(): Promise<void> {
    const gen = ++this.gen;
    this.failed = '';
    try {
      const r = await getMessagingSettings();
      if (gen !== this.gen) return;
      this.adopt(r);
    } catch (err) {
      if (gen !== this.gen) return;
      this.failed = describeError(err);
    } finally {
      if (gen === this.gen) this.loading = false;
    }
  }

  private adopt(r: MessagingSettingsReply): void {
    this.reply = r;
    this.draft = toDraft(r.settings);
    this.base = snapshot(this.draft);
    this.submitted = false;
    this.touched = new Set();
    this.remote = [];
    this.notice = '';
  }

  // ------------------------------------------------------------------ editing

  private set(patch: Partial<Draft>, path = ''): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, ...patch };
    this.notice = '';
    this.remote = [];
    if (path) this.touched = new Set([...this.touched, path]);
  }

  private setRow(i: number, patch: Partial<Row>, field: 'label' | 'body'): void {
    if (!this.draft) return;
    this.set({ templates: this.draft.templates.map((t, k) => (k === i ? { ...t, ...patch } : t)) }, `templates.${i}.${field}`);
  }

  private addRow(): void {
    if (!this.draft) return;
    this.set({ templates: [...this.draft.templates, { key: nextKey(), label: mt('template.new'), body: '' }] });
  }

  private removeRow(i: number): void {
    if (!this.draft) return;
    this.set({ templates: this.draft.templates.filter((_t, k) => k !== i) });
    this.touched = new Set();
  }

  private insert(i: number, token: string, area: HTMLTextAreaElement | null): void {
    if (!this.draft) return;
    const row = this.draft.templates[i];
    const next = insertAt(row.body, token, area?.selectionStart ?? null, area?.selectionEnd ?? null);
    this.setRow(i, { body: next.text }, 'body');
    void this.updateComplete.then(() => {
      area?.focus();
      area?.setSelectionRange(next.caret, next.caret);
    });
  }

  private revert(): void {
    if (this.reply) this.adopt(this.reply);
    this.notice = '';
  }

  private get dirty(): boolean {
    return !!this.draft && snapshot(this.draft) !== this.base;
  }

  private problems(): SettingsProblem[] {
    if (!this.draft) return [];
    const local = settingsProblems(toDoc(this.draft), this.reply?.limits ?? DEFAULT_LIMITS);
    return [...local, ...this.remote.filter((r) => !local.some((l) => l.path === r.path))];
  }

  private async save(): Promise<void> {
    if (!this.draft || this.saving) return;
    this.submitted = true;
    if (this.problems().length) return;
    this.saving = true;
    this.notice = '';
    try {
      const r = await putMessagingSettings(toDoc(this.draft));
      this.adopt(r);
      this.notice = 'saved';
    } catch (err) {
      const list = serverProblems(err);
      if (list) {
        this.remote = list;
        this.notice = 'failed';
        this.noticeText = mt('invalid');
      } else if (isSettingsConflict(err)) {
        this.notice = 'conflict';
      } else {
        this.notice = 'failed';
        this.noticeText = `${mt('save_failed')} · ${describeError(err)}`;
      }
    } finally {
      this.saving = false;
    }
  }

  // ------------------------------------------------------------------ render

  private shown(path: string): SettingsProblem[] {
    return this.submitted || this.touched.has(path) ? problemsAt(this.problems(), path) : [];
  }

  private problemLine(path: string): TemplateResult | typeof nothing {
    const list = this.shown(path);
    return list.length ? html`<div class="problem" role="alert" data-msg-problem=${list[0].code} data-msg-problem-path=${path}><sw-icon name="warning" size=${14}></sw-icon><span>${withPlaceholders(problemText(list[0].code))}</span></div>` : nothing;
  }

  private serviceLine(r: MessagingSettingsReply): TemplateResult {
    const s = r.service;
    let tone = 'ok';
    let text: string;
    if (s.problem) {
      tone = 'warn';
      text = mt(`service.${s.problem}` as Parameters<typeof mt>[0]);
    } else if (s.connected === true) {
      const name = s.accounts.length === 1 ? s.accounts[0].name : s.accounts.find((a) => a.id === this.draft?.account)?.name;
      text = name ? `${mt('service.connected')} · ${mt('service.account', { name })}` : mt('service.connected');
    } else if (s.connected === false) {
      tone = 'warn';
      text = s.state === 'unsupported' ? mt('service.unsupported') : mt('service.not_connected');
    } else {
      tone = 'muted';
      text = mt('service.unknown');
    }
    return html`<div class="svc" data-msg-service=${s.connected === true && !s.problem ? 'connected' : s.connected === false ? 'not_connected' : 'unknown'}><span class="dot ${tone}"></span><span>${text}</span></div>`;
  }

  private renderTemplate(row: Row, i: number, limits: MessagingSettingsReply['limits']): TemplateResult {
    const label = this.shown(`templates.${i}.label`);
    const body = this.shown(`templates.${i}.body`);
    return html`<div class="tpl" data-msg-template-row=${i} data-msg-template-key=${row.id ?? 'new'}>
      <div class="tpl-head">
        <sw-field label=${mt('template.label')} ?data-bad=${label.length > 0}>
          <input type="text" maxlength=${limits.label_max * 2} .value=${row.label} data-msg-template-label @input=${(e: Event) => this.setRow(i, { label: (e.target as HTMLInputElement).value }, 'label')} />
        </sw-field>
        <sw-button variant="ghost" iconOnly icon="trash" label=${mt('template.remove')} data-msg-template-remove @click=${() => this.removeRow(i)}></sw-button>
      </div>
      ${this.problemLine(`templates.${i}.label`)}
      <sw-field label=${mt('template.body')} ?data-bad=${body.length > 0}>
        <textarea rows="4" .value=${row.body} data-msg-template-body @input=${(e: Event) => this.setRow(i, { body: (e.target as HTMLTextAreaElement).value }, 'body')}></textarea>
      </sw-field>
      ${this.problemLine(`templates.${i}.body`)}
      <div class="tpl-foot">
        <div class="chips">
          <button type="button" class="chipbtn" data-msg-insert="name" @click=${(e: Event) => this.insert(i, '{name}', this.textareaOf(e))}>${mt('template.insert_name')}</button>
          <button type="button" class="chipbtn" data-msg-insert="organization" @click=${(e: Event) => this.insert(i, '{organization}', this.textareaOf(e))}>${mt('template.insert_org')}</button>
        </div>
        <span class="cnt" aria-hidden="true">${mt('template.counter', { n: row.body.length, max: limits.body_max })}</span>
      </div>
    </div>`;
  }

  private textareaOf(e: Event): HTMLTextAreaElement | null {
    return (e.currentTarget as HTMLElement).closest('.tpl')?.querySelector('textarea') ?? null;
  }

  /** WA-CONSENT-LINK: consent by link (off by default) - the switch, how long a request waits, its language, the WhatsApp Business
   * template the request must use outside the 24-hour window (approved by Meta: the owner's action), and whether the public page can serve
   * the link now. */
  private renderConsent(d: Draft, r: MessagingSettingsReply) {
    const c = r.consent;
    const problem = c?.page_problem ?? null;
    return html`<sw-card flush data-msg-settings-card="consent">
      <div class="ch"><div><h3>${mt('consent.title')}</h3><div class="sub">${mt('consent.sub')}</div></div></div>
      <button type="button" class="sw" role="switch" aria-checked=${String(d.consent_by_link)} data-msg-setting="consent_by_link" @click=${() => this.set({ consent_by_link: !d.consent_by_link }, 'consent_by_link')}>
        <span class="txt"><span class="t">${mt('consent.switch')}</span><span class="x">${d.consent_by_link ? mt('consent.on') : mt('consent.off')}</span></span>
        <span class="track" aria-hidden="true"></span>
      </button>
      ${this.problemLine('consent_by_link')}
      ${d.consent_by_link && problem ? html`<div class="note err" role="alert" data-msg-consent-problem=${problem}><sw-icon name="warning" size=${16}></sw-icon><span>${mt(consentProblemKey(problem))}</span></div>` : nothing}
      <div class="fields">
        <div>
          <sw-field label=${mt('consent.wait')} hint=${mt('consent.wait_hint', { min: c?.wait_days[0] ?? 1, max: c?.wait_days[1] ?? 30 })} ?data-bad=${this.shown('consent_wait_days').length > 0}>
            <input type="text" inputmode="numeric" .value=${d.consent_wait_days} data-msg-setting="consent_wait_days" @input=${(e: Event) => this.set({ consent_wait_days: (e.target as HTMLInputElement).value }, 'consent_wait_days')} />
          </sw-field>
          ${this.problemLine('consent_wait_days')}
        </div>
        <div>
          <sw-field label=${mt('consent.language')}>
            <select data-msg-setting="consent_language" @change=${(e: Event) => this.set({ consent_language: (e.target as HTMLSelectElement).value })}>
              ${CONSENT_LANGS.map((l) => html`<option value=${l} ?selected=${d.consent_language === l}>${mt(`consent.lang.${l}` as MessagingKey)}</option>`)}
            </select>
          </sw-field>
        </div>
        <div>
          <sw-field label=${mt('consent.wa_template')} hint=${mt('consent.wa_template_hint')} ?data-bad=${this.shown('consent_wa_template').length > 0}>
            <input type="text" dir="ltr" .value=${d.consent_wa_template} data-msg-setting="consent_wa_template" @input=${(e: Event) => this.set({ consent_wa_template: (e.target as HTMLInputElement).value }, 'consent_wa_template')} />
          </sw-field>
          ${this.problemLine('consent_wa_template')}
        </div>
        <div>
          <sw-field label=${mt('consent.wa_language')} ?data-bad=${this.shown('consent_wa_language').length > 0}>
            <input type="text" dir="ltr" .value=${d.consent_wa_language} data-msg-setting="consent_wa_language" @input=${(e: Event) => this.set({ consent_wa_language: (e.target as HTMLInputElement).value }, 'consent_wa_language')} />
          </sw-field>
          ${this.problemLine('consent_wa_language')}
        </div>
      </div>
      <div class="hint" data-msg-consent-rules>${mt('consent.rules', { days: c?.resend_days ?? 30, held: c?.held_per_person ?? 3 })}</div>
    </sw-card>`;
  }

  render() {
    if (this.loading) return html`<div class="stack" data-access-status="loading"><sw-card flush>${skeletonRows(4)}</sw-card></div>`;
    if (!this.draft || !this.reply) return html`<div class="stack" data-access-status="error">${failurePanel('error', this.failed, () => void this.load())}</div>`;
    const d = this.draft;
    const r = this.reply;
    const limits = r.limits;
    const accounts = r.service.accounts;
    const dirty = this.dirty;
    const bad = this.submitted && this.problems().length > 0;
    return html`<div class="stack" data-access-status="ready" data-msg-settings>
      <sw-card flush data-msg-settings-card="general">
        <div class="ch"><div><h3>${mt('title')}</h3><div class="sub">${mt('sub')}</div></div></div>
        ${this.serviceLine(r)}
        <button type="button" class="sw" role="switch" aria-checked=${String(d.enabled)} data-msg-setting="enabled" @click=${() => this.set({ enabled: !d.enabled })}>
          <span class="txt"><span class="t">${mt('enabled.title')}</span><span class="x">${d.enabled ? mt('enabled.on') : mt('enabled.off')}</span></span>
          <span class="track" aria-hidden="true"></span>
        </button>
        <button type="button" class="sw" role="switch" aria-checked=${String(d.free_text)} data-msg-setting="free_text" @click=${() => this.set({ free_text: !d.free_text })}>
          <span class="txt"><span class="t">${mt('free.title')}</span><span class="x">${d.free_text ? mt('free.on') : mt('free.off')}</span></span>
          <span class="track" aria-hidden="true"></span>
        </button>
        <div class="fields">
          <div>
            <sw-field label=${mt('bulk.title')} hint=${mt('bulk.hint', { min: limits.bulk_max[0], max: limits.bulk_max[1] })} ?data-bad=${this.shown('bulk_max').length > 0}>
              <input type="text" inputmode="numeric" .value=${d.bulk_max} data-msg-setting="bulk_max" @input=${(e: Event) => this.set({ bulk_max: (e.target as HTMLInputElement).value }, 'bulk_max')} />
            </sw-field>
            ${this.problemLine('bulk_max')}
          </div>
          <div>
            <sw-field label=${mt('rate.title')} hint=${mt('rate.hint', { min: limits.rate_per_hour[0], max: limits.rate_per_hour[1] })} ?data-bad=${this.shown('rate_per_hour').length > 0}>
              <input type="text" inputmode="numeric" .value=${d.rate_per_hour} data-msg-setting="rate_per_hour" @input=${(e: Event) => this.set({ rate_per_hour: (e.target as HTMLInputElement).value }, 'rate_per_hour')} />
            </sw-field>
            ${this.problemLine('rate_per_hour')}
          </div>
          <div>
            <sw-field label=${mt('org.title')} ?data-bad=${this.shown('organization').length > 0}>
              <input type="text" .value=${d.organization} data-msg-setting="organization" @input=${(e: Event) => this.set({ organization: (e.target as HTMLInputElement).value }, 'organization')} />
            </sw-field>
            <div class="hint" data-msg-org-hint>${withPlaceholders(mt('org.hint'))}</div>
            ${this.problemLine('organization')}
          </div>
          ${accounts.length > 1
            ? html`<div>
                <sw-field label=${mt('account.title')}>
                  <select data-msg-setting="account" @change=${(e: Event) => this.set({ account: (e.target as HTMLSelectElement).value })}>
                    <option value="" ?selected=${d.account === ''}>${mt('account.choose')}</option>
                    ${accounts.map((a) => html`<option value=${a.id} ?selected=${d.account === a.id}>${a.name}</option>`)}
                  </select>
                </sw-field>
              </div>`
            : nothing}
        </div>
      </sw-card>

      ${this.renderConsent(d, r)}

      <sw-card flush data-msg-settings-card="templates">
        <div class="ch">
          <div><h3>${mt('templates.title')}</h3><div class="sub">${withPlaceholders(mt('templates.sub'))}</div></div>
          <div class="ctl"><sw-button icon="plus" data-msg-template-add ?disabled=${d.templates.length >= limits.templates_max} @click=${() => this.addRow()}>${mt('template.add')}</sw-button></div>
        </div>
        ${this.problemLine('templates')}
        ${d.templates.length === 0 ? html`<div class="empty" data-msg-templates-empty>${mt('templates.empty')}</div>` : d.templates.map((row, i) => this.renderTemplate(row, i, limits))}
      </sw-card>

      <div class="actions" data-msg-actions>
        <span class="grow">
          ${this.notice === 'saved' ? html`<span class="note info" role="status" data-msg-notice="saved"><sw-icon name="check" size=${16}></sw-icon><span>${mt('saved')}</span></span>` : nothing}
          ${this.notice === 'failed' ? html`<span class="note err" role="alert" data-msg-notice="failed"><sw-icon name="warning" size=${16}></sw-icon><span>${this.noticeText}</span></span>` : nothing}
          ${this.notice === 'conflict'
            ? html`<span class="note stale" role="alert" data-msg-notice="conflict"><sw-icon name="warning" size=${16}></sw-icon><span>${mt('conflict')}</span><sw-button size="sm" data-msg-reload @click=${() => void this.load()}>${mt('reload')}</sw-button></span>`
            : nothing}
          ${this.notice === '' && bad ? html`<span class="note err" role="alert" data-msg-notice="invalid"><sw-icon name="warning" size=${16}></sw-icon><span>${mt('invalid')}</span></span>` : nothing}
          ${this.notice === '' && !bad && dirty ? html`<span class="note info" data-msg-notice="unsaved"><span>${mt('unsaved')}</span></span>` : nothing}
        </span>
        <sw-button data-msg-revert ?disabled=${!dirty || this.saving} @click=${() => this.revert()}>${mt('revert')}</sw-button>
        <sw-button variant="primary" data-msg-save ?disabled=${!dirty || this.saving} @click=${() => void this.save()}>${this.saving ? mt('saving') : mt('save')}</sw-button>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-access-messaging': SystemAccessMessaging;
  }
}
